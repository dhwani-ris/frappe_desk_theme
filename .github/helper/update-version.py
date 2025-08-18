#!/usr/bin/env python3
"""
Helper script to update version in Frappe app __init__.py files
Usage: python .github/helper/update-version.py <new_version>
"""
import os
import re
import sys

def update_version_in_init_files(new_version):
    """Update version in all app __init__.py files"""
    updated_files = []
    
    # Look for directories that contain __init__.py (potential Frappe apps)
    for item in os.listdir('.'):
        if os.path.isdir(item) and item not in ['node_modules', '.git', '__pycache__', '.github']:
            init_file = os.path.join(item, '__init__.py')
            if os.path.exists(init_file):
                try:
                    with open(init_file, 'r') as f:
                        content = f.read()
                    
                    # Update version using regex
                    pattern = r'__version__\s*=\s*["\'][0-9]+\.[0-9]+\.[0-9]+["\']'
                    replacement = f'__version__ = "{new_version}"'
                    
                    if re.search(pattern, content):
                        updated_content = re.sub(pattern, replacement, content)
                        
                        with open(init_file, 'w') as f:
                            f.write(updated_content)
                        
                        updated_files.append(init_file)
                        print(f"Updated version in {init_file} to {new_version}")
                    else:
                        print(f"No version found in {init_file}")
                        
                except Exception as e:
                    print(f"Error updating {init_file}: {e}")
    
    return updated_files

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/update-version.py <new_version>")
        sys.exit(1)
    
    new_version = sys.argv[1]
    updated_files = update_version_in_init_files(new_version)
    
    if updated_files:
        print(f"Successfully updated version to {new_version} in {len(updated_files)} files")
    else:
        print("No files were updated")
