"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Archive,
  File,
  GraduationCap,
  Inbox,
  Link as LinkIcon,
  Mail,
  RefreshCw,
  Search,
  Send,
  SquarePen,
  Trash2,
  Unlink,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type MatchedSchool = { id: string; name: string };

type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  labelIds: string[] | null;
  matchedSchool: MatchedSchool | null;
};

type MessageDetail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: { text: string; html: string };
};

type SchoolOption = { id: string; name: string };

type MailFolder = {
  id: string;
  label: string;
  icon: typeof Inbox;
  query: string;
};

const MAIL_FOLDERS: MailFolder[] = [
  { id: "inbox", label: "Inbox", icon: Inbox, query: "in:inbox" },
  { id: "drafts", label: "Drafts", icon: File, query: "in:drafts" },
  { id: "sent", label: "Sent", icon: Send, query: "in:sent" },
  { id: "trash", label: "Trash", icon: Trash2, query: "in:trash" },
  { id: "archive", label: "Archive", icon: Archive, query: "-in:inbox -in:sent -in:trash -in:drafts" },
];

export function MailPageClient() {
  const [authChecked, setAuthChecked] = React.useState(false);
  const [authenticated, setAuthenticated] = React.useState(false);

  const [activeFolder, setActiveFolder] = React.useState("inbox");
  const [filterEdu, setFilterEdu] = React.useState(false);
  const [filterDbMatch, setFilterDbMatch] = React.useState(false);
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const [messages, setMessages] = React.useState<GmailMessage[]>([]);
  const [nextPageToken, setNextPageToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [selectedMessage, setSelectedMessage] = React.useState<MessageDetail | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedMeta, setSelectedMeta] = React.useState<GmailMessage | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [composeTo, setComposeTo] = React.useState("");
  const [composeSubject, setComposeSubject] = React.useState("");
  const [composeBody, setComposeBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [linkMessageId, setLinkMessageId] = React.useState<string | null>(null);
  const [linkSenderEmail, setLinkSenderEmail] = React.useState("");
  const [linkSubject, setLinkSubject] = React.useState("");
  const [linkSchoolId, setLinkSchoolId] = React.useState("");
  const [linkingBusy, setLinkingBusy] = React.useState(false);
  const [schools, setSchools] = React.useState<SchoolOption[]>([]);
  const [schoolSearch, setSchoolSearch] = React.useState("");

  React.useEffect(() => {
    fetch("/api/gmail/auth-status")
      .then((r) => r.json())
      .then((d: { authenticated: boolean }) => {
        setAuthenticated(d.authenticated);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  const buildQuery = React.useCallback(
    (folder: string, search: string, unread: boolean, edu: boolean) => {
      const folderDef = MAIL_FOLDERS.find((f) => f.id === folder);
      const parts: string[] = [];
      if (folderDef) parts.push(folderDef.query);
      if (edu) parts.push("from:.edu");
      if (unread) parts.push("is:unread");
      if (search.trim()) parts.push(search.trim());
      return parts.join(" ");
    },
    [],
  );

  const fetchMessages = React.useCallback(
    async (folder: string, search: string, unread: boolean, edu: boolean, pageToken?: string) => {
      setLoading(true);
      try {
        const q = buildQuery(folder, search, unread, edu);
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (pageToken) params.set("pageToken", pageToken);
        params.set("maxResults", "20");

        const res = await fetch(`/api/gmail/messages?${params}`);
        if (!res.ok) {
          if (res.status === 401) {
            setAuthenticated(false);
            return;
          }
          toast.error("Failed to load messages");
          return;
        }
        const data = (await res.json()) as {
          messages: GmailMessage[];
          nextPageToken: string | null;
        };
        if (pageToken) {
          setMessages((prev) => [...prev, ...data.messages]);
        } else {
          setMessages(data.messages);
        }
        setNextPageToken(data.nextPageToken);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  React.useEffect(() => {
    if (authenticated) {
      fetchMessages(activeFolder, searchQuery, unreadOnly, filterEdu);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const switchFolder = (folderId: string) => {
    setActiveFolder(folderId);
    setSearchQuery("");
    setSelectedMessage(null);
    setSelectedId(null);
    setSelectedMeta(null);
    fetchMessages(folderId, "", unreadOnly, filterEdu);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedMessage(null);
    setSelectedId(null);
    setSelectedMeta(null);
    fetchMessages(activeFolder, searchQuery, unreadOnly, filterEdu);
  };

  const handleRefresh = () => {
    fetchMessages(activeFolder, searchQuery, unreadOnly, filterEdu);
  };

  const toggleUnread = (val: boolean) => {
    setUnreadOnly(val);
    setSelectedMessage(null);
    setSelectedId(null);
    setSelectedMeta(null);
    fetchMessages(activeFolder, searchQuery, val, filterEdu);
  };

  const toggleEdu = () => {
    const next = !filterEdu;
    setFilterEdu(next);
    setSelectedMessage(null);
    setSelectedId(null);
    setSelectedMeta(null);
    fetchMessages(activeFolder, searchQuery, unreadOnly, next);
  };

  const toggleDbMatch = () => {
    setFilterDbMatch((prev) => !prev);
  };

  const loadMore = () => {
    if (nextPageToken) {
      fetchMessages(activeFolder, searchQuery, unreadOnly, filterEdu, nextPageToken);
    }
  };

  const openMessage = async (msg: GmailMessage) => {
    setSelectedId(msg.id);
    setSelectedMeta(msg);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/gmail/messages/${msg.id}`);
      if (!res.ok) {
        toast.error("Failed to load message");
        return;
      }
      const data = (await res.json()) as MessageDetail;
      setSelectedMessage(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) {
      toast.error("To and Subject are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          messageBody: composeBody,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to send message");
        return;
      }
      toast.success("Message sent");
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      handleRefresh();
    } finally {
      setSending(false);
    }
  };

  const openLinkDialog = (msg: GmailMessage) => {
    setLinkMessageId(msg.id);
    setLinkSenderEmail(extractAddr(msg.from));
    setLinkSubject(msg.subject);
    setLinkSchoolId("");
    setSchoolSearch("");
    setLinkDialogOpen(true);

    if (schools.length === 0) {
      fetch("/api/schools")
        .then((r) => r.json())
        .then((data: SchoolOption[]) =>
          setSchools(
            data
              .map((s: SchoolOption) => ({ id: s.id, name: s.name }))
              .sort((a: SchoolOption, b: SchoolOption) => a.name.localeCompare(b.name)),
          ),
        )
        .catch(() => toast.error("Failed to load schools"));
    }
  };

  const handleLink = async () => {
    if (!linkMessageId || !linkSchoolId) return;
    setLinkingBusy(true);
    try {
      const res = await fetch("/api/gmail/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailMessageId: linkMessageId,
          schoolId: linkSchoolId,
          senderEmail: linkSenderEmail,
          subject: linkSubject,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to link");
        return;
      }
      const data = (await res.json()) as { school: { id: string; name: string } };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === linkMessageId ? { ...m, matchedSchool: data.school } : m,
        ),
      );
      if (selectedMeta && selectedMeta.id === linkMessageId) {
        setSelectedMeta({ ...selectedMeta, matchedSchool: data.school });
      }
      toast.success(`Linked to ${data.school.name}`);
      setLinkDialogOpen(false);
    } finally {
      setLinkingBusy(false);
    }
  };

  const handleDelete = async (msgId: string) => {
    try {
      const res = await fetch(`/api/gmail/messages/${encodeURIComponent(msgId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete message");
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (selectedId === msgId) {
        setSelectedMessage(null);
        setSelectedId(null);
        setSelectedMeta(null);
      }
      toast.success("Moved to trash");
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const handleUnlink = async (msgId: string) => {
    const res = await fetch(`/api/gmail/link?gmailMessageId=${encodeURIComponent(msgId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to unlink");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, matchedSchool: null } : m)),
    );
    if (selectedMeta && selectedMeta.id === msgId) {
      setSelectedMeta({ ...selectedMeta, matchedSchool: null });
    }
    toast.success("Unlinked from school");
  };

  const displayMessages = filterDbMatch
    ? messages.filter((m) => m.matchedSchool)
    : messages;

  const currentFolderLabel =
    MAIL_FOLDERS.find((f) => f.id === activeFolder)?.label ?? "Inbox";

  // --- Auth gate ---
  if (!authChecked) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking authentication...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-4 text-center">
          <Mail className="mx-auto size-12 text-muted-foreground" />
          <h2 className="text-lg font-medium">Connect your Gmail account</h2>
          <p className="text-sm text-muted-foreground">
            Sign in with Google to view and send emails, and track school communications.
          </p>
          <Button onClick={() => signIn("google")}>Connect Gmail</Button>
        </div>
      </div>
    );
  }

  const filteredSchools = schoolSearch
    ? schools.filter((s) =>
        s.name.toLowerCase().includes(schoolSearch.toLowerCase()),
      )
    : schools;

  // --- 3-panel layout ---
  return (
    <>
      {/* Panel 1: Mail Nav */}
      <div className="flex w-56 shrink-0 flex-col border-r bg-background">
        <div className="p-3">
          <Button
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => {
              setComposeTo("");
              setComposeSubject("");
              setComposeBody("");
              setComposeOpen(true);
            }}
          >
            <SquarePen className="size-4" />
            Compose
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2">
          {MAIL_FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => switchFolder(folder.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {folder.label}
              </button>
            );
          })}

          <Separator className="!my-2" />

          <button
            type="button"
            onClick={toggleEdu}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              filterEdu
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <GraduationCap className="size-4" />
            College Recruiting
          </button>
          <button
            type="button"
            onClick={toggleDbMatch}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              filterDbMatch
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <LinkIcon className="size-4" />
            DB Match
          </button>
        </nav>
      </div>

      {/* Panel 2: Message List */}
      <div className="flex w-[350px] shrink-0 flex-col border-r">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{currentFolderLabel}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Tabs: All mail / Unread */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => toggleUnread(false)}
            className={`flex-1 px-4 py-2 text-center text-sm transition-colors ${
              !unreadOnly
                ? "border-b-2 border-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All mail
          </button>
          <button
            type="button"
            onClick={() => toggleUnread(true)}
            className={`flex-1 px-4 py-2 text-center text-sm transition-colors ${
              unreadOnly
                ? "border-b-2 border-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Unread
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
        </form>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {loading && messages.length === 0 ? (
            <div className="space-y-0 divide-y">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse bg-muted/30" />
              ))}
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {filterDbMatch ? "No matched emails found" : "No messages"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {displayMessages.map((msg) => {
                const isSelected = selectedId === msg.id;
                const isUnread = msg.labelIds?.includes("UNREAD");
                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => openMessage(msg)}
                    className={`group w-full px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "bg-accent"
                        : isEduSender(msg.from)
                          ? "bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:hover:bg-yellow-900/40"
                          : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`min-w-0 truncate text-sm ${
                          isUnread ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {formatSender(msg.from)}
                      </span>
                      {msg.matchedSchool && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                          {msg.matchedSchool.name}
                        </Badge>
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {formatDate(msg.date)}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-sm ${
                        isUnread ? "font-medium" : ""
                      }`}
                    >
                      {msg.subject || "(no subject)"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {msg.snippet}
                    </p>
                  </button>
                );
              })}

              {nextPageToken && (
                <div className="p-2">
                  <Button
                    variant="ghost"
                    className="w-full text-xs"
                    size="sm"
                    onClick={loadMore}
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Panel 3: Reading Pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        {loadingDetail ? (
          <div className="flex flex-1 items-center justify-center">
            <RefreshCw className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : selectedMessage ? (
          <>
            {/* Message header */}
            <div className="border-b px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">
                    {selectedMessage.subject || "(no subject)"}
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatSender(selectedMessage.from)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      &lt;{extractAddr(selectedMessage.from)}&gt;
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    To: {selectedMessage.to}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDateLong(selectedMessage.date)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      title="Move to trash"
                      onClick={() => handleDelete(selectedMessage.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {selectedMeta && (
                    <div className="flex items-center gap-1">
                      {selectedMeta.matchedSchool ? (
                        <>
                          <Link href={`/schools/${selectedMeta.matchedSchool.id}`}>
                            <Badge variant="secondary">
                              {selectedMeta.matchedSchool.name}
                            </Badge>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Unlink from school"
                            onClick={() => handleUnlink(selectedMeta.id)}
                          >
                            <Unlink className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openLinkDialog(selectedMeta)}
                        >
                          <LinkIcon className="mr-1 size-3" />
                          Link to school
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Message body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {selectedMessage.body.html ? (
                <EmailHtmlFrame html={selectedMessage.body.html} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {selectedMessage.body.text || "(empty message)"}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Mail className="size-10" />
            <p className="text-sm">Select a message to read</p>
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose email</DialogTitle>
            <DialogDescription>Send a new email from your Gmail account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="compose-to">To</Label>
              <Input
                id="compose-to"
                type="email"
                placeholder="coach@university.edu"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-body">Message</Label>
              <Textarea
                id="compose-body"
                rows={8}
                className="resize-y"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSend()} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to School Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link to school</DialogTitle>
            <DialogDescription>
              Tag this email as being from a specific school. This will also mark the school as
              &quot;Coach contacted us.&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Sender</Label>
              <p className="text-sm text-muted-foreground">{linkSenderEmail}</p>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <p className="truncate text-sm text-muted-foreground">
                {linkSubject || "(no subject)"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-school">School</Label>
              <Input
                placeholder="Search schools..."
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                className="mb-2"
              />
              <Select value={linkSchoolId} onValueChange={setLinkSchoolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredSchools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  {filteredSchools.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No schools found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleLink()}
              disabled={linkingBusy || !linkSchoolId}
            >
              {linkingBusy ? "Linking..." : "Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmailHtmlFrame({ html }: { html: string }) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a; overflow-x: hidden; word-break: break-word; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100% !important; }
  pre { white-space: pre-wrap; overflow-x: auto; }
  a { color: #2563eb; }
</style></head><body>${html}</body></html>`);
    doc.close();

    const resize = () => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = iframe.contentDocument.body.scrollHeight + "px";
      }
    };
    resize();
    const timer = setTimeout(resize, 300);
    const observer = new ResizeObserver(resize);
    if (iframe.contentDocument?.body) {
      observer.observe(iframe.contentDocument.body);
    }
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full border-0"
      sandbox="allow-same-origin"
      title="Email content"
    />
  );
}

function extractAddr(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function isEduSender(from: string): boolean {
  const addr = extractAddr(from);
  const domain = addr.split("@")[1];
  return !!domain && domain.toLowerCase().endsWith(".edu");
}

function formatSender(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from.split("@")[0] || from;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
