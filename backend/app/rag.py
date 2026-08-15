import os

from openai import OpenAI

from .vector_store import vector_store


client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


SYSTEM_PROMPT = """
You are LawDoc AI, a legal document question-answering assistant.

Your job is to answer questions using ONLY the retrieved context from
the user's uploaded legal document.

STRICT RULES:

1. Do not use outside knowledge.
2. Do not invent facts, clauses, dates, amounts, obligations, or rights.
3. If the answer cannot be found in the provided context, say:
   "I could not find that information in the uploaded document."
4. Clearly explain the answer.
5. Mention page numbers when useful.
6. You are not a lawyer.
7. Do not provide personalized legal advice.
8. Do not claim that an answer is legally binding.
9. If the document is ambiguous, say that it is ambiguous.
"""


def generate_answer(
    document_id,
    question,
):
    sources = vector_store.search(
        document_id=document_id,
        query=question,
        top_k=5,
    )

    if not sources:
        return {
            "answer": (
                "I could not find relevant information "
                "in the uploaded document."
            ),
            "sources": [],
        }

    context_parts = []

    for source in sources:
        context_parts.append(
            f"""
[Page {source['page']}]

{source['text']}
"""
        )

    context = "\n\n".join(context_parts)

    user_prompt = f"""
Use the following retrieved document passages to answer
the user's question.

DOCUMENT CONTEXT:

{context}

USER QUESTION:

{question}

IMPORTANT:

Answer ONLY from the document context.

If the context does not contain enough information to answer
the question, say:

"I could not find that information in the uploaded document."

Do not use outside knowledge.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=0,
            max_tokens=1000,
        )

        answer = response.choices[0].message.content

        return {
            "answer": answer,
            "sources": sources,
        }

    except Exception as error:
        print("LLM error:", error)

        raise RuntimeError(
            f"AI generation failed: {str(error)}"
        )