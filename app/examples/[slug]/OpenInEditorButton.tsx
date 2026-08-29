"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { launchProjectEditor } from "@/lib/client/editor-workspace";
import { PUBLIC_DEMOS, type PublicDemoId } from "@/lib/demo/public-demo-gallery";

export default function OpenInEditorButton({ demoId, className }: { demoId: PublicDemoId; className?: string }) {
  const router = useRouter();
  const demo = PUBLIC_DEMOS.find((item) => item.id === demoId);
  return (
    <Link
      href={`/editor?demo=${demoId}`}
      className={className}
      onClick={(event) => {
        if (!demo) return;
        event.preventDefault();
        void launchProjectEditor(demo.result.project, "demo").then((href) => router.push(href));
      }}
    >
      Edit this project <span aria-hidden="true">→</span>
    </Link>
  );
}
