import { Container, Grid, Text, Title } from '@mantine/core';
import AppLayout from '@components/AppLayout';
import WishlistCard from '@components/WishlistCard';

const MOCK_ITEMS = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `Wishlist item ${i + 1}`,
  price: Math.floor(Math.random() * 200) + 10,
  category: ['Tech', 'Books', 'Fashion', 'Home'][i % 4],
}));

export default function HomePage() {
  return (
    <AppLayout>
      <Container size="xl">
        <Title mb="sm">Wishlist</Title>
        <Text c="dimmed" mb="xl">Browse and save the things you love.</Text>
        <Grid>
          {MOCK_ITEMS.map((item) => (
            <Grid.Col key={item.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
              <WishlistCard
                title={item.title}
                price={item.price}
                category={item.category}
              />
            </Grid.Col>
          ))}
        </Grid>
      </Container>
    </AppLayout>
  );
}
