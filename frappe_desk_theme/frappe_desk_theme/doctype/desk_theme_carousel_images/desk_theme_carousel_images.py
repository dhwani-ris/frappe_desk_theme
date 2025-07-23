# Copyright (c) 2025, Dhwani RIS and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class DeskThemeCarouselImages(Document):
    def validate(self):
        # Validate image size (max 5 MB)
        if self.image:
            file_doc = frappe.get_doc('File', {'file_url': self.image})
            if file_doc.file_size > 1 * 1024 * 1024:
                frappe.throw('Carousel image size must be 1 MB or less.')
