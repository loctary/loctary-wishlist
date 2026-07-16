import { useEffect, useRef, useState } from "react";
import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconLink } from "@tabler/icons-react";

/**
 * Copy-a-public-link control (the "share one link" promise on the landing
 * page). Copies `origin + path` to the clipboard and confirms with a toast —
 * or says so when the browser refuses, rather than pretending it copied.
 *
 * `variant="button"` is the labelled header control; `variant="icon"` is the
 * compact ActionIcon for tighter rows (item detail). `disabled` is for content
 * that can't be shared right now (a hidden wishlist) — the tooltip says why.
 */
export function ShareButton({
  path,
  variant = "button",
  disabled = false,
  disabledReason,
}: {
  /** Site-relative path to share, e.g. `/user/1/wishlists/2`. */
  path: string;
  variant?: "button" | "icon";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
      notifications.show({ color: "teal", message: "Link copied" });
    } catch {
      notifications.show({
        color: "red",
        message: "Couldn't access the clipboard — copy the link from the address bar",
      });
    }
  };

  const tooltip = disabled ? disabledReason : copied ? "Copied" : "Copy link";

  if (variant === "icon") {
    return (
      <Tooltip label={tooltip} disabled={!tooltip}>
        <ActionIcon
          variant="default"
          size="lg"
          radius="md"
          aria-label="Copy link"
          disabled={disabled}
          onClick={onCopy}
        >
          {copied ? <IconCheck size={17} /> : <IconLink size={17} />}
        </ActionIcon>
      </Tooltip>
    );
  }

  return (
    <Tooltip label={tooltip} disabled={!disabled}>
      <Button
        variant="default"
        disabled={disabled}
        onClick={onCopy}
        leftSection={copied ? <IconCheck size={17} /> : <IconLink size={17} />}
      >
        {copied ? "Copied" : "Share"}
      </Button>
    </Tooltip>
  );
}
