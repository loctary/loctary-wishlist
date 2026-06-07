import { Badge, Button, Card, Group, Image, Text } from '@mantine/core';

export interface WishlistCardProps {
  id: number;
  title: string;
  price: number;
  category: string;
  image: string;
}

export function WishlistCard({ title, price, category, image }: WishlistCardProps) {
  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Card.Section>
        <Image
          src={image}
          height={160}
          alt={title}
          fallbackSrc={`https://placehold.co/400x160/ff8b09/ffffff?text=${encodeURIComponent(category)}`}
        />
      </Card.Section>
      <Group justify="space-between" mt="md" mb={4}>
        <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1 }}>
          {title}
        </Text>
        <Badge color="orange" variant="light" size="sm">
          {category}
        </Badge>
      </Group>
      <Text size="lg" fw={700} c="orange" mb="md">
        ${price.toFixed(2)}
      </Text>
      <Button variant="light" color="orange" fullWidth radius="md" size="sm">
        Add to wishlist
      </Button>
    </Card>
  );
}
