import { useState } from "react";
import Cropper from "react-easy-crop";
import {
  Box,
  Button,
  FileButton,
  Group,
  Modal,
  Slider,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { getCroppedItemImage, type CropArea } from "../lib/cropImage";
import { uploadImage, WishlistApiError } from "../lib/api";

const ACCEPT = "image/*";

/**
 * Modal that picks → crops to 4:3 → compresses to ≤300KB WebP → uploads to the
 * staging bucket, then hands back the public URL via `onUploaded`. The image
 * isn't attached to any item yet — the caller drops the URL into the form's
 * `images` array. If the user never submits, the nightly cron sweeps the
 * orphaned R2 object after 24h.
 */
export function ImageCropperModal({
  opened,
  onClose,
  onUploaded,
}: {
  opened: boolean;
  onClose: () => void;
  onUploaded: (url: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setBusy(false);
  }

  function close() {
    reset();
    onClose();
  }

  function pickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notifications.show({ color: "red", message: "Please choose an image file." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!src || !area) return;
    setBusy(true);
    try {
      const blob = await getCroppedItemImage(src, area);
      const { url } = await uploadImage(blob);
      onUploaded(url);
      close();
    } catch (e) {
      const message =
        e instanceof WishlistApiError ? e.message :
        e instanceof Error ? e.message : "Could not process the image.";
      notifications.show({ color: "red", message });
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Add image" centered size="md">
      <Stack gap="md">
        {src ? (
          <>
            <Box
              style={{
                position: "relative",
                width: "100%",
                height: 320,
                background: "var(--mantine-color-dark-6, #222)",
                borderRadius: "var(--mantine-radius-md)",
                overflow: "hidden",
              }}
            >
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_a, areaPixels) => setArea(areaPixels)}
              />
            </Box>
            <div>
              <Text size="sm" mb={4}>
                Zoom
              </Text>
              <Slider min={1} max={3} step={0.05} value={zoom} onChange={setZoom} label={null} />
            </div>
            <Group justify="space-between">
              <FileButton onChange={pickFile} accept={ACCEPT}>
                {(props) => (
                  <Button variant="subtle" size="sm" {...props}>
                    Choose another
                  </Button>
                )}
              </FileButton>
              <Button size="sm" loading={busy} onClick={save}>
                Save
              </Button>
            </Group>
          </>
        ) : (
          <Stack gap="sm" align="center" py="lg">
            <Text c="dimmed" size="sm" ta="center">
              Pick a photo. You can crop it to 4:3 — we&apos;ll compress it to under 300KB.
            </Text>
            <FileButton onChange={pickFile} accept={ACCEPT}>
              {(props) => <Button {...props}>Choose image</Button>}
            </FileButton>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
