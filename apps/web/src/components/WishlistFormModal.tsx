import { useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Input,
  Modal,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPhoto, IconPlus, IconX } from "@tabler/icons-react";
import type { AdminWishlist, WishlistInput } from "../lib/api";
import { ImageCropperModal } from "./ImageCropperModal";
import { PriorityPicker, type Priority } from "./PriorityPicker";

/**
 * Create/edit form for a wishlist. Cover image is picked → cropped → uploaded
 * to R2 via the shared staging endpoint (same flow as item images); the URL is
 * kept in local state and submitted with the wishlist. If the user closes the
 * modal without saving, the nightly cron reaps the staged object after 24h.
 */
export function WishlistFormModal({
  opened,
  onClose,
  initial,
  submitting,
  submitLabel = "Save",
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  initial?: AdminWishlist;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (input: WishlistInput) => void;
}) {
  const [cover, setCover] = useState<string | null>(initial?.coverImageUrl ?? null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const form = useForm({
    initialValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      isActive: initial?.isActive ?? true,
      // Discrete 1 (Low) / 2 (Medium) / 3 (High); default new lists to Medium.
      priority: (initial?.position ?? 2) as Priority,
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      coverImageUrl: cover ?? null,
      isActive: values.isActive,
      position: values.priority,
    });
  });

  return (
    <Modal.Root opened={opened} onClose={onClose} size="lg" centered>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{initial ? "Edit wishlist" : "New wishlist"}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body
          p={0}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "1 1 auto",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                overflowY: "auto",
                flex: "1 1 auto",
                minHeight: 0,
                padding: "var(--mantine-spacing-md)",
              }}
            >
              <Stack>
                <TextInput label="Title" withAsterisk {...form.getInputProps("title")} />
                <Textarea
                  label="Description"
                  autosize
                  minRows={2}
                  {...form.getInputProps("description")}
                />

                <Input.Wrapper
                  label="Cover image"
                  description="Optional — 4:3, ≤300KB. Shown on the list's tile and page."
                >
                  <CoverPicker
                    url={cover}
                    onPick={() => setCropperOpen(true)}
                    onClear={() => setCover(null)}
                  />
                </Input.Wrapper>

                <PriorityPicker
                  value={form.values.priority}
                  onChange={(p) => form.setFieldValue("priority", p)}
                  description="Higher shows higher in your list index"
                />
                <Switch
                  label="Active"
                  description="Inactive wishlists (and everything on them) are hidden from the public"
                  {...form.getInputProps("isActive", { type: "checkbox" })}
                />
              </Stack>
            </div>

            <Group
              justify="flex-end"
              style={{
                padding: "var(--mantine-spacing-sm) var(--mantine-spacing-md)",
                borderTop: "1px solid var(--mantine-color-default-border)",
                flexShrink: 0,
              }}
            >
              <Button variant="default" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {submitLabel}
              </Button>
            </Group>
          </form>

          <ImageCropperModal
            opened={cropperOpen}
            onClose={() => setCropperOpen(false)}
            onUploaded={(url) => setCover(url)}
          />
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

function CoverPicker({
  url,
  onPick,
  onClear,
}: {
  url: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (url) {
    return (
      <Box
        mt={4}
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          maxWidth: 320,
          borderRadius: "var(--mantine-radius-md)",
          overflow: "hidden",
          background: "var(--mantine-color-gray-1)",
        }}
      >
        <img
          src={url}
          alt="Cover"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          draggable={false}
        />
        <ActionIcon
          variant="filled"
          color="dark"
          size="sm"
          radius="xl"
          onClick={onClear}
          aria-label="Remove cover"
          style={{ position: "absolute", top: 6, right: 6, opacity: 0.85 }}
        >
          <IconX size={14} />
        </ActionIcon>
        <Button
          variant="filled"
          color="dark"
          size="xs"
          onClick={onPick}
          leftSection={<IconPhoto size={14} />}
          style={{ position: "absolute", left: 6, bottom: 6, opacity: 0.85 }}
        >
          Change
        </Button>
      </Box>
    );
  }
  return (
    <Box mt={4} maw={320}>
      <button
        type="button"
        onClick={onPick}
        aria-label="Select cover"
        style={{
          aspectRatio: "4 / 3",
          width: "100%",
          border: "2px dashed var(--mantine-color-default)",
          borderRadius: "var(--mantine-radius-md)",
          background: "transparent",
          color: "var(--mantine-color-dimmed)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          font: "inherit",
        }}
      >
        <IconPlus size={22} />
        <Text size="xs" c="dimmed">
          Select cover
        </Text>
      </button>
    </Box>
  );
}
