"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ROUTES } from "../routes";

// Every run is private until its owner publishes it. Guests can't publish: a guest session has
// no account to stand behind a public prompt, so the control says how to get one instead.
export function PublishControl({ id, published: initial, registered }: { id: string; published: boolean; registered: boolean }) {
  const [published, setPublished] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!registered) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Tag tone="outline">Private</Tag>
        <Link href={ROUTES.signUp} className="t-meta inline-block py-2 underline underline-offset-2 hover:text-ink">
          Create an account to publish
        </Link>
      </span>
    );
  }

  async function toggle() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/log/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !published }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) setPublished(out.published);
    else setError(out.message ?? "That didn't change. Try again.");
    setPending(false);
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Tag tone={published ? "ink" : "outline"}>{published ? "Public" : "Private"}</Tag>
      <Button size="sm" variant="secondary" onClick={toggle} pending={pending}>
        {published ? "Make private" : "Publish"}
      </Button>
      {error && (
        <span role="alert" className="t-meta !text-charged">
          {error}
        </span>
      )}
    </span>
  );
}
