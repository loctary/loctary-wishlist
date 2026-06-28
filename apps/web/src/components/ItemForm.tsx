import { useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Input,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconX } from "@tabler/icons-react";
import type { AdminWishItem, ItemInput } from "../lib/api";
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

  const form = useForm({
    initialValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      price: initial?.price ?? ("" as number | ""),
      currency: initial?.currency ?? "USD",
      priority: initial?.position ?? 0,
      isActive: initial?.isActive ?? true,
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
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
        <NumberInput
          label="Priority"
          description="Higher shows higher on your wishlist"
          {...form.getInputProps("priority")}
        />
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
