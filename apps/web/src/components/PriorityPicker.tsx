import { Input, SegmentedControl, Text } from "@mantine/core";
import { IconBolt } from "@tabler/icons-react";

/**
 * Discrete priority: 1 (Low) / 2 (Medium) / 3 (High). Rendered as a
 * SegmentedControl with 1..3 amber lightning bolts + a text label — shared
 * across the item form and the wishlist form so the two "Priority" fields
 * behave and look identical.
 */
export type Priority = 1 | 2 | 3;

export function PriorityPicker({
  value,
  onChange,
  label = "Priority",
  description,
}: {
  value: Priority;
  onChange: (next: Priority) => void;
  label?: string;
  description?: string;
}) {
  return (
    <Input.Wrapper label={label} description={description}>
      <div>
        <SegmentedControl
          fullWidth
          value={String(value)}
          onChange={(v) => onChange(Number(v) as Priority)}
          data={[
            { value: "1", label: <Bolts count={1} label="Low" /> },
            { value: "2", label: <Bolts count={2} label="Medium" /> },
            { value: "3", label: <Bolts count={3} label="High" /> },
          ]}
        />
      </div>
    </Input.Wrapper>
  );
}

function Bolts({ count, label }: { count: Priority; label: string }) {
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
