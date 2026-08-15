from pypdf import PdfReader


def extract_pdf_pages(file_path):
    reader = PdfReader(file_path)

    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        text = text.strip()

        if text:
            pages.append(
                {
                    "page": page_number,
                    "text": text,
                }
            )

    return pages


def create_chunks(
    pages,
    chunk_size=1000,
    overlap=200,
):
    chunks = []

    for page in pages:
        text = page["text"]

        start = 0

        while start < len(text):
            end = start + chunk_size

            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append(
                    {
                        "page": page["page"],
                        "text": chunk_text,
                    }
                )

            next_start = end - overlap

            if next_start <= start:
                break

            start = next_start

    return chunks