import { Badge, Card, Group, Image, Text } from '@mantine/core';

interface WishlistCardProps {
  title: string;
  price: number;
  category: string;
  imageUrl?: string;
}

export default function WishlistCard({ title, price, category, imageUrl }: WishlistCardProps) {
  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      {imageUrl && (
        <Card.Section>
          <Image src={imageUrl} height={140} alt={title} />
        </Card.Section>
      )}
      <Group justify="space-between" mt="md" mb="xs">
        <Text fw={500} lineClamp={1}>{title}</Text>
        <Badge color="orange" variant="light">{category}</Badge>
      </Group>
      <Text size="sm" c="dimmed">${price.toFixed(2)}</Text>
    </Card>
  );
}
