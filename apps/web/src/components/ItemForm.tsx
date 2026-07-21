import { useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Input,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconBolt, IconPlus, IconWand, IconX } from "@tabler/icons-react";
import { scrapeProductUrl, WishlistApiError, type AdminWishItem, type ItemInput } from "../lib/api";
import { ImageCropperModal } from "./ImageCropperModal";

const MAX_IMAGES = 3;

/**
 * Create/edit form for a wishlist item. Images live in local `images` state:
 * the cropper modal uploads each one to R2 and we append its URL here, so the
 * submit payload is the full ordered list. Trimming inputs / dropping empty
 * strings happens in `handleSubmit`.
 */
export function ItemForm({
  initial,
  submitting,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  initial?: AdminWishItem;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (input: ItemInput) => void;
  onCancel?: () => void;
}) {
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [scraping, setScraping] = useState(false);

  const form = useForm({
    initialValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      url: initial?.url ?? "",
      price: initial?.price ?? ("" as number | ""),
      currency: initial?.currency ?? "USD",
      // Discrete 1 (Low) / 2 (Medium) / 3 (High); default new items to Medium.
      priority: (initial?.position ?? 2) as 1 | 2 | 3,
      isActive: initial?.isActive ?? true,
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      url: (v) => {
        const trimmed = v.trim();
        if (trimmed.length === 0) return null;
        try {
          const parsed = new URL(trimmed);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "Must start with http:// or https://";
          }
          return null;
        } catch {
          return "Enter a valid URL";
        }
      },
    },
  });

  /**
   * Ask the server to fetch the Product URL and pull whatever product metadata
   * it can (OG / Twitter / JSON-LD). Overwrites every field the scraper
   * returns a value for — treating Fetch as an explicit "replace with what
   * the source page says" action — and appends the returned image (already
   * mirrored to R2 server-side) if there's a slot free.
   */
  async function fetchFromLink() {
    const url = form.values.url.trim();
    if (!url) {
      form.setFieldError("url", "Enter a URL first");
      return;
    }
    if (form.validateField("url").hasError) return;

    setScraping(true);
    try {
      const scraped = await scrapeProductUrl(url);
      let filled = 0;
      if (scraped.title) {
        form.setFieldValue("title", scraped.title);
        filled++;
      }
      if (scraped.description) {
        form.setFieldValue("description", scraped.description);
        filled++;
      }
      if (scraped.price !== null) {
        form.setFieldValue("price", scraped.price);
        filled++;
        if (scraped.currency) form.setFieldValue("currency", scraped.currency);
      }
      if (scraped.imageUrl && images.length < MAX_IMAGES) {
        setImages((prev) => [...prev, scraped.imageUrl!]);
        filled++;
      }
      notifications.show({
        color: filled ? "moss" : "yellow",
        message: filled
          ? `Filled in ${filled} field${filled === 1 ? "" : "s"} from the link.`
          : "We couldn't find anything new on that page.",
      });
    } catch (e) {
      const message =
        e instanceof WishlistApiError ? e.message :
        e instanceof Error ? e.message : "Could not read that page.";
      notifications.show({ color: "red", message });
    } finally {
      setScraping(false);
    }
  }

  const handleSubmit = form.onSubmit((values) => {
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      url: values.url.trim() || null,
      price: values.price === "" ? null : Number(values.price),
      currency: values.currency.trim() || "USD",
      // The form's single "Priority" field is the table's `position` column —
      // the higher, the closer to the top of the list.
      position: values.priority,
      isActive: values.isActive,
      images,
    });
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput
          label="Title"
          withAsterisk
          {...form.getInputProps("title")}
        />
        <Textarea
          label="Description"
          autosize
          minRows={2}
          {...form.getInputProps("description")}
        />
        <Stack gap={6}>
          <TextInput
            label="Product URL"
            description="Paste a link and hit Fetch to autofill the rest"
            placeholder="https://…"
            type="url"
            inputMode="url"
            {...form.getInputProps("url")}
          />
          <Group justify="flex-end">
            <Button
              type="button"
              variant="light"
              size="xs"
              leftSection={<IconWand size={14} />}
              loading={scraping}
              onClick={fetchFromLink}
              disabled={!form.values.url.trim()}
            >
              Fetch from link
            </Button>
          </Group>
        </Stack>

        <Input.Wrapper
          label="Images"
          description={`Up to ${MAX_IMAGES} photos at 4:3 (≤300KB each). The first is the cover.`}
        >
          <ImagesGrid
            images={images}
            onRemove={(idx) =>
              setImages((prev) => prev.filter((_, i) => i !== idx))
            }
            onAdd={() => setCropperOpen(true)}
          />
        </Input.Wrapper>

        <Group grow>
          <NumberInput
            label="Price"
            min={0}
            decimalScale={2}
            {...form.getInputProps("price")}
          />
          <TextInput
            label="Currency"
            maxLength={3}
            {...form.getInputProps("currency")}
          />
        </Group>
        <Input.Wrapper
          label="Priority"
          description="Higher shows higher on your wishlist"
        >
          <div>
            <SegmentedControl
              fullWidth
              value={String(form.values.priority)}
              onChange={(v) => form.setFieldValue("priority", Number(v) as 1 | 2 | 3)}
              data={[
                { value: "1", label: <PriorityBolts count={1} label="Low" /> },
                { value: "2", label: <PriorityBolts count={2} label="Medium" /> },
                { value: "3", label: <PriorityBolts count={3} label="High" /> },
              ]}
            />
          </div>
        </Input.Wrapper>
        <Switch
          label="Active"
          description="Inactive items are hidden from your public wishlist"
          {...form.getInputProps("isActive", { type: "checkbox" })}
        />
        <Group justify="flex-end" mt="sm">
          {onCancel && (
            <Button variant="default" onClick={onCancel} type="button">
              Cancel
            </Button>
          )}
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>

      <ImageCropperModal
        opened={cropperOpen}
        onClose={() => setCropperOpen(false)}
        onUploaded={(url) => setImages((prev) => [...prev, url])}
      />
    </form>
  );
}

/**
 * 3-column grid of 4:3 tiles. Each existing image is a thumbnail with an X
 * button; if there's room left, the last cell is a dashed-border "Select
 * image" placeholder the same size as a thumbnail.
 */
function ImagesGrid({
  images,
  onRemove,
  onAdd,
}: {
  images: string[];
  onRemove: (idx: number) => void;
  onAdd: () => void;
}) {
  return (
    <SimpleGrid cols={3} spacing="sm" mt={4}>
      {images.map((url, idx) => (
        <Box
          key={url}
          style={{
            position: "relative",
            aspectRatio: "4 / 3",
            borderRadius: "var(--mantine-radius-md)",
            overflow: "hidden",
            background: "var(--mantine-color-gray-1)",
          }}
        >
          <img
            src={url}
            alt={idx === 0 ? "Cover" : `Image ${idx + 1}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            draggable={false}
          />
          <ActionIcon
            variant="filled"
            color="dark"
            size="sm"
            radius="xl"
            onClick={() => onRemove(idx)}
            aria-label="Remove image"
            style={{ position: "absolute", top: 6, right: 6, opacity: 0.85 }}
          >
            <IconX size={14} />
          </ActionIcon>
          {idx === 0 && (
            <Text
              size="xs"
              fw={700}
              c="white"
              style={{
                position: "absolute",
                left: 6,
                bottom: 6,
                background: "rgba(0,0,0,0.55)",
                padding: "2px 8px",
                borderRadius: "var(--mantine-radius-sm)",
              }}
            >
              Cover
            </Text>
          )}
        </Box>
      ))}

      {images.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Select image"
          style={{
            aspectRatio: "4 / 3",
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
            padding: 8,
            font: "inherit",
          }}
        >
          <IconPlus size={22} />
          <Text size="xs" c="dimmed">
            Select image
          </Text>
        </button>
      )}
    </SimpleGrid>
  );
}

/** One SegmentedControl segment: 1-3 lightning icons + a readable label under them. */
function PriorityBolts({ count, label }: { count: 1 | 2 | 3; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        lineHeight: 1,
      }}
    >
      <span style={{ display: "inline-flex", gap: 1 }} aria-hidden>
        {Array.from({ length: count }).map((_, i) => (
          <IconBolt
            key={i}
            size={16}
            stroke={0}
            fill="var(--mantine-color-amber-6)"
            style={{ color: "var(--mantine-color-amber-6)" }}
          />
        ))}
      </span>
      <Text size="xs" fw={500}>
        {label}
      </Text>
    </span>
  );
}
