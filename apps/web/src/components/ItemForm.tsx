import {
  Button,
  Group,
  NumberInput,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import type { AdminWishItem, ItemInput } from "../lib/api";

/**
 * Create/edit form for a wishlist item. Returns a clean `ItemInput` (empty
 * strings → null) so optional fields aren't sent as "".
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
  const form = useForm({
    initialValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      url: initial?.url ?? "",
      imageUrl: initial?.imageUrl ?? "",
      price: initial?.price ?? ("" as number | ""),
      currency: initial?.currency ?? "USD",
      priority: initial?.priority ?? 0,
      position: initial?.position ?? 0,
    },
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      url: (v) => (v && !/^https?:\/\//i.test(v) ? "Must start with http(s)://" : null),
      imageUrl: (v) => (v && !/^https?:\/\//i.test(v) ? "Must start with http(s)://" : null),
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      url: values.url.trim() || null,
      imageUrl: values.imageUrl.trim() || null,
      price: values.price === "" ? null : Number(values.price),
      currency: values.currency.trim() || "USD",
      priority: values.priority,
      position: values.position,
    });
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <TextInput label="Title" withAsterisk {...form.getInputProps("title")} />
        <Textarea label="Description" autosize minRows={2} {...form.getInputProps("description")} />
        <TextInput label="Product URL" placeholder="https://…" {...form.getInputProps("url")} />
        <TextInput label="Image URL" placeholder="https://…" {...form.getInputProps("imageUrl")} />
        <Group grow>
          <NumberInput label="Price" min={0} decimalScale={2} {...form.getInputProps("price")} />
          <TextInput label="Currency" maxLength={3} {...form.getInputProps("currency")} />
        </Group>
        <Group grow>
          <NumberInput
            label="Priority"
            description="Higher shows as more wanted"
            {...form.getInputProps("priority")}
          />
          <NumberInput
            label="Position"
            description="Higher sorts first"
            {...form.getInputProps("position")}
          />
        </Group>
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
    </form>
  );
}
