import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Upload,
  FileText,
  MessageSquare,
  Send,
  Trash2,
  Plus,
  Bot,
  User,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileSearch,
  Copy,
  Check,
  Scale,
} from "lucide-react";

const API_URL = "http://localhost:8000";

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ---------------------------------------
  // LOAD DOCUMENTS
  // ---------------------------------------

  const loadDocuments = async () => {
    try {
      setError("");

      const response = await fetch(`${API_URL}/api/documents`);

      if (!response.ok) {
        throw new Error("Could not load documents.");
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to connect to LawDoc AI. Make sure the FastAPI server is running."
      );
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // ---------------------------------------
  // SELECT DOCUMENT
  // ---------------------------------------

  const selectDocument = (document) => {
    setSelectedDocument(document);

    setMessages([
      {
        role: "assistant",
        content: `I've loaded **${document.filename}**.\n\nAsk me anything about this document. I'll retrieve relevant sections before answering.`,
      },
    ]);

    setQuestion("");
    setError("");
    setSidebarOpen(false);
  };

  // ---------------------------------------
  // NEW CHAT
  // ---------------------------------------

  const startNewChat = () => {
    if (!selectedDocument) return;

    setMessages([
      {
        role: "assistant",
        content: `New conversation started for **${selectedDocument.filename}**.\n\nWhat would you like to know?`,
      },
    ]);

    setQuestion("");
    setError("");
    textareaRef.current?.focus();
  };

  // ---------------------------------------
  // UPLOAD PDF
  // ---------------------------------------

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Only PDF documents are supported.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("The PDF is too large. Maximum size is 20MB.");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Document upload failed.");
      }

      await loadDocuments();

      const uploadedDocument = data.document;

      setSelectedDocument(uploadedDocument);

      setMessages([
        {
          role: "assistant",
          content: `### Document ready ✓\n\n**${file.name}** has been successfully uploaded and indexed.\n\nYou can now ask questions about its contents.`,
        },
      ]);

      setSidebarOpen(false);
    } catch (err) {
      console.error("Upload error:", err);

      setError(
        err.message ||
          "Unable to upload the document. Check that the backend is running."
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ---------------------------------------
  // DELETE DOCUMENT
  // ---------------------------------------

  const deleteDocument = async (documentId) => {
    const confirmed = window.confirm(
      "Delete this document and its indexed data?"
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/documents/${documentId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Delete failed.");
      }

      setDocuments((current) =>
        current.filter((doc) => doc.id !== documentId)
      );

      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to delete the document.");
    }
  };

  // ---------------------------------------
  // ASK RAG
  // ---------------------------------------

  const askQuestion = async (text = question) => {
    const cleanQuestion = text.trim();

    if (!cleanQuestion || loading) return;

    if (!selectedDocument) {
      setError("Please upload and select a document first.");
      return;
    }

    setQuestion("");
    setError("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: cleanQuestion,
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
          document_id: selectedDocument.id,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to process your question.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.answer ||
            "I could not find an answer in the uploaded document.",
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          error: true,
          content:
            err.message ||
            "I couldn't process that question. Please check the backend.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------
  // ENTER TO SEND
  // ---------------------------------------

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
    }
  };

  // ---------------------------------------
  // COPY ANSWER
  // ---------------------------------------

  const copyAnswer = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------------------------------
  // RENDER
  // ---------------------------------------

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      {/* MOBILE HEADER */}

      <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Logo />

          <div>
            <h1 className="font-bold text-sm">LawDoc AI</h1>
            <p className="text-[10px] text-slate-400">
              Document Intelligence
            </p>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"
        >
          <Menu size={21} />
        </button>
      </header>

      <div className="flex min-h-[calc(100vh-64px)] lg:min-h-screen">
        {/* MOBILE OVERLAY */}

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/40 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}

        <aside
          className={`
            fixed lg:static z-40 inset-y-0 left-0
            w-[300px] bg-white border-r border-slate-200
            flex flex-col
            transform transition-transform duration-300
            ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full lg:translate-x-0"
            }
          `}
        >
          {/* BRAND */}

          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Logo />

                <div>
                  <h1 className="font-bold text-lg tracking-tight">
                    LawDoc AI
                  </h1>

                  <p className="text-xs text-slate-400">
                    Document Intelligence
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ACTIONS */}

          <div className="p-4 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={handleUpload}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="
                w-full flex items-center justify-center gap-2
                bg-slate-950 text-white rounded-xl py-3.5
                hover:bg-slate-800 transition
                disabled:opacity-60
                shadow-sm
              "
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Upload size={18} />
              )}

              {uploading ? "Indexing document..." : "Upload Legal PDF"}
            </button>

            {selectedDocument && (
              <button
                onClick={startNewChat}
                className="
                  w-full flex items-center justify-center gap-2
                  border border-slate-200 bg-white
                  rounded-xl py-3
                  hover:bg-slate-50 transition
                  text-sm font-medium
                "
              >
                <Plus size={17} />
                New Chat
              </button>
            )}

            {uploading && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="flex items-center gap-2">
                  <Loader2
                    size={14}
                    className="animate-spin text-slate-500"
                  />

                  <span className="text-xs text-slate-500">
                    Extracting text and creating embeddings...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* DOCUMENTS */}

          <div className="flex-1 overflow-y-auto px-3">
            <div className="px-3 py-2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                Your Documents
              </p>

              <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                {documents.length}
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 mx-auto flex items-center justify-center mb-3">
                  <FileText size={21} className="text-slate-300" />
                </div>

                <p className="text-sm font-semibold text-slate-500">
                  No documents
                </p>

                <p className="text-xs text-slate-400 mt-1 leading-5">
                  Upload a legal PDF to begin.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    selected={selectedDocument?.id === document.id}
                    onSelect={() => selectDocument(document)}
                    onDelete={() => deleteDocument(document.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SIDEBAR FOOTER */}

          <div className="p-4 border-t border-slate-100">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck size={17} />
                </div>

                <div>
                  <p className="text-xs font-semibold">
                    Grounded AI
                  </p>

                  <p className="text-[10px] text-slate-400 leading-4 mt-1">
                    Answers are generated from your uploaded documents.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}

        <main className="flex-1 flex flex-col min-w-0">
          {/* DESKTOP HEADER */}

          <header className="hidden lg:flex h-[76px] bg-white border-b border-slate-200 px-8 items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.18em] font-bold">
                Document Assistant
              </p>

              <h2 className="font-semibold mt-1 truncate max-w-[600px]">
                {selectedDocument
                  ? selectedDocument.filename
                  : "Select a document to begin"}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              {selectedDocument && (
                <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400">
                  <FileText size={14} />
                  {selectedDocument.pages || 0} pages
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                AI Online
              </div>
            </div>
          </header>

          {/* ERROR */}

          {error && (
            <div className="mx-4 lg:mx-8 mt-4">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700">
                <AlertCircle size={18} />

                <p className="text-sm flex-1">{error}</p>

                <button
                  onClick={() => setError("")}
                  className="p-1 rounded hover:bg-red-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* CONTENT */}

          <div className="flex-1 overflow-y-auto">
            {!selectedDocument ? (
              <WelcomeScreen
                onUpload={() => fileInputRef.current?.click()}
              />
            ) : (
              <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8">
                {/* DOCUMENT INFO */}

                <div className="mb-8 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                    <FileText size={22} className="text-red-500" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">
                      Currently analyzing
                    </p>

                    <h2 className="font-semibold truncate">
                      {selectedDocument.filename}
                    </h2>

                    <p className="text-xs text-slate-400 mt-1">
                      {selectedDocument.pages || 0} pages
                      {" • "}
                      {selectedDocument.chunks || 0} indexed chunks
                    </p>
                  </div>
                </div>

                {messages.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-950 mx-auto flex items-center justify-center mb-4 shadow-lg">
                      <Bot size={24} className="text-white" />
                    </div>

                    <h2 className="text-2xl font-bold">
                      Ask about your document
                    </h2>

                    <p className="text-slate-500 mt-2">
                      LawDoc AI retrieves relevant passages before answering.
                    </p>
                  </div>
                )}

                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={index}
                      message={message}
                      index={index}
                      onCopy={copyAnswer}
                      copied={copiedIndex === index}
                    />
                  ))}

                  {loading && <LoadingMessage />}
                </div>
              </div>
            )}
          </div>

          {/* INPUT */}

          {selectedDocument && (
            <div className="border-t border-slate-200 bg-white">
              <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4">
                {messages.length <= 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                    <Suggestion
                      text="What is the termination notice period?"
                      onClick={askQuestion}
                    />

                    <Suggestion
                      text="What are the main obligations?"
                      onClick={askQuestion}
                    />

                    <Suggestion
                      text="What are the payment terms?"
                      onClick={askQuestion}
                    />
                  </div>
                )}

                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about this document..."
                    rows={1}
                    className="
                      w-full resize-none rounded-2xl
                      border border-slate-200
                      bg-slate-50
                      px-4 py-4 pr-14
                      outline-none
                      focus:ring-2 focus:ring-slate-950/10
                      focus:border-slate-400
                      transition
                    "
                  />

                  <button
                    onClick={() => askQuestion()}
                    disabled={!question.trim() || loading}
                    className="
                      absolute right-2 bottom-2
                      w-10 h-10 rounded-xl
                      bg-slate-950 text-white
                      flex items-center justify-center
                      disabled:opacity-30
                      hover:bg-slate-800
                      transition
                    "
                  >
                    {loading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-slate-400">
                  <ShieldCheck size={12} />

                  <span>
                    Responses are grounded in your uploaded document.
                  </span>
                </div>

                <p className="text-center text-[9px] text-slate-400 mt-1">
                  LawDoc AI is not a substitute for professional legal advice.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================
// LOGO
// ============================================

function Logo() {
  return (
    <div className="w-11 h-11 rounded-2xl bg-slate-950 flex items-center justify-center shadow-sm">
      <Scale size={22} className="text-white" />
    </div>
  );
}

// ============================================
// DOCUMENT CARD
// ============================================

function DocumentCard({
  document,
  selected,
  onSelect,
  onDelete,
}) {
  return (
    <div
      onClick={onSelect}
      className={`
        group rounded-2xl p-3 cursor-pointer
        flex items-center gap-3
        border transition-all duration-200
        ${
          selected
            ? "bg-slate-950 text-white border-slate-950 shadow-md"
            : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
        }
      `}
    >
      <div
        className={`
          w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
          ${selected ? "bg-white/10" : "bg-red-50"}
        `}
      >
        <FileText
          size={18}
          className={selected ? "text-white" : "text-red-500"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold truncate ${
            selected ? "text-white" : "text-slate-800"
          }`}
        >
          {document.filename}
        </p>

        <p
          className={`text-[10px] mt-1 ${
            selected ? "text-slate-400" : "text-slate-400"
          }`}
        >
          {document.pages || 0} pages
          {" • "}
          {document.chunks || 0} chunks
        </p>
      </div>

      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className={`
          p-2 rounded-lg
          opacity-0 group-hover:opacity-100
          transition
          ${
            selected
              ? "hover:bg-white/10"
              : "hover:bg-red-50"
          }
        `}
      >
        <Trash2
          size={15}
          className={selected ? "text-slate-300" : "text-red-500"}
        />
      </button>
    </div>
  );
}

// ============================================
// WELCOME
// ============================================

function WelcomeScreen({ onUpload }) {
  return (
    <div className="min-h-full flex items-center justify-center p-6 lg:p-10">
      <div className="max-w-3xl w-full text-center">
        <div className="relative inline-flex mb-7">
          <div className="w-20 h-20 rounded-[28px] bg-slate-950 flex items-center justify-center shadow-xl">
            <Scale size={34} className="text-white" />
          </div>

          <div className="absolute -right-3 -top-3 w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Sparkles size={16} />
          </div>
        </div>

        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-bold mb-3">
          AI-Powered Legal Documents
        </p>

        <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
          Welcome to LawDoc AI
        </h2>

        <p className="text-slate-500 leading-7 mt-5 max-w-2xl mx-auto">
          Upload a legal document and ask questions in natural language.
          LawDoc AI retrieves relevant passages from your document before
          generating an answer.
        </p>

        <button
          onClick={onUpload}
          className="
            mt-8 inline-flex items-center gap-2
            bg-slate-950 text-white
            px-7 py-3.5 rounded-xl
            hover:bg-slate-800
            shadow-lg
            transition
          "
        >
          <Upload size={18} />
          Upload Legal PDF
        </button>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <Feature
            icon={<Upload size={18} />}
            title="Upload"
            text="Upload contracts, agreements and other legal PDFs."
          />

          <Feature
            icon={<FileSearch size={18} />}
            title="Retrieve"
            text="Find relevant sections using semantic search."
          />

          <Feature
            icon={<MessageSquare size={18} />}
            title="Ask"
            text="Ask natural-language questions about your document."
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// FEATURE
// ============================================

function Feature({ icon, title, text }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
        {icon}
      </div>

      <p className="font-semibold text-sm">{title}</p>

      <p className="text-xs text-slate-500 mt-2 leading-5">
        {text}
      </p>
    </div>
  );
}

// ============================================
// SUGGESTION
// ============================================

function Suggestion({ text, onClick }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="
        flex-shrink-0
        px-3.5 py-2.5
        rounded-xl
        border border-slate-200
        bg-white
        text-xs text-slate-600
        hover:bg-slate-50
        hover:border-slate-300
        transition
        whitespace-nowrap
      "
    >
      {text}

      <ChevronRight
        size={13}
        className="inline ml-1"
      />
    </button>
  );
}

// ============================================
// LOADING
// ============================================

function LoadingMessage() {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center flex-shrink-0">
        <Bot size={17} className="text-white" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
          </div>

          <span className="text-xs text-slate-400">
            Searching your document and generating an answer...
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CHAT MESSAGE
// ============================================

function ChatMessage({
  message,
  index,
  onCopy,
  copied,
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center flex-shrink-0 shadow-sm">
          {message.error ? (
            <AlertCircle size={17} className="text-red-400" />
          ) : (
            <Bot size={17} className="text-white" />
          )}
        </div>
      )}

      <div
        className={`
          max-w-[88%] lg:max-w-[78%]
          rounded-2xl px-4 py-4
          ${
            isUser
              ? "bg-slate-950 text-white rounded-tr-sm"
              : message.error
              ? "bg-red-50 border border-red-100 text-red-700 rounded-tl-sm"
              : "bg-white border border-slate-200 rounded-tl-sm shadow-sm"
          }
        `}
      >
        <div
          className={`text-sm leading-7 ${
            isUser ? "text-white" : "text-slate-700"
          }`}
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-lg font-bold mb-3">
                  {children}
                </h1>
              ),

              h2: ({ children }) => (
                <h2 className="text-base font-bold mb-2">
                  {children}
                </h2>
              ),

              h3: ({ children }) => (
                <h3 className="font-semibold mb-2">
                  {children}
                </h3>
              ),

              p: ({ children }) => (
                <p className="mb-3 last:mb-0">
                  {children}
                </p>
              ),

              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-3 space-y-1">
                  {children}
                </ul>
              ),

              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-3 space-y-1">
                  {children}
                </ol>
              ),

              strong: ({ children }) => (
                <strong className="font-bold">
                  {children}
                </strong>
              ),

              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-slate-300 pl-4 my-3 text-slate-500 italic">
                  {children}
                </blockquote>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* COPY */}

        {!isUser && !message.error && (
          <button
            onClick={() => onCopy(message.content, index)}
            className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-700 transition"
          >
            {copied ? (
              <>
                <Check size={12} />
                Copied
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy answer
              </>
            )}
          </button>
        )}

        {/* SOURCES */}

        {message.sources?.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-3">
              <FileSearch size={14} />
              Retrieved Sources
              <span className="text-slate-400 font-normal">
                ({message.sources.length})
              </span>
            </div>

            <div className="space-y-2">
              {message.sources.map((source, sourceIndex) => (
                <SourceCard
                  key={sourceIndex}
                  source={source}
                  index={sourceIndex}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
          <User size={17} />
        </div>
      )}
    </div>
  );
}

// ============================================
// SOURCE
// ============================================

function SourceCard({ source, index }) {
  const score =
    typeof source.score === "number"
      ? source.score.toFixed(3)
      : null;

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
            <FileText size={13} className="text-slate-500" />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700">
              Source {index + 1}
            </p>

            <p className="text-[10px] text-slate-400">
              Page {source.page || "—"}
            </p>
          </div>
        </div>

        {score !== null && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-200 text-slate-600">
            Similarity {score}
          </span>
        )}
      </div>

      {source.text && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {source.text}
        </p>
      )}
    </div>
  );
}

export default App;