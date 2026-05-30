import { Container, SimpleGrid, Text, Title } from '@mantine/core';
import type { NextPage } from 'next';
import Head from 'next/head';
import { WishlistCard, type WishlistCardProps } from '@components/WishlistCard';

const MOCK_ITEMS: WishlistCardProps[] = [
  { id: 1,  title: 'Sony WH-1000XM5 Headphones',    price: 349.99, category: 'Electronics', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=160&fit=crop' },
  { id: 2,  title: 'Kindle Paperwhite',               price: 139.99, category: 'Books',       image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=160&fit=crop' },
  { id: 3,  title: 'Nike Air Max 270',                price: 150.00, category: 'Shoes',       image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=160&fit=crop' },
  { id: 4,  title: 'Instant Pot Duo 7-in-1',         price: 99.95,  category: 'Kitchen',     image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=160&fit=crop' },
  { id: 5,  title: 'Lego Technic McLaren',            price: 449.99, category: 'Toys',        image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&h=160&fit=crop' },
  { id: 6,  title: 'Patagonia Nano Puff Jacket',     price: 229.00, category: 'Clothing',    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=160&fit=crop' },
  { id: 7,  title: 'Apple AirPods Pro',               price: 249.00, category: 'Electronics', image: 'https://images.unsplash.com/photo-1588423771073-b8903fead85b?w=400&h=160&fit=crop' },
  { id: 8,  title: 'Vitamix 5200 Blender',            price: 549.95, category: 'Kitchen',     image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=160&fit=crop' },
  { id: 9,  title: 'Moleskine Classic Notebook',      price: 21.99,  category: 'Books',       image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400&h=160&fit=crop' },
  { id: 10, title: 'Adidas Ultraboost 23',            price: 190.00, category: 'Shoes',       image: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&h=160&fit=crop' },
  { id: 11, title: 'DJI Mini 3 Drone',                price: 759.00, category: 'Electronics', image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&h=160&fit=crop' },
  { id: 12, title: 'Le Creuset Dutch Oven',           price: 369.95, category: 'Kitchen',     image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=160&fit=crop' },
  { id: 13, title: 'Osprey Atmos 65 Backpack',        price: 270.00, category: 'Outdoor',     image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=160&fit=crop' },
  { id: 14, title: 'Levi\'s 511 Slim Jeans',          price: 69.50,  category: 'Clothing',    image: 'https://images.unsplash.com/photo-1542574271-7f3b92e6c821?w=400&h=160&fit=crop' },
  { id: 15, title: 'Ember Temperature Mug²',          price: 149.95, category: 'Kitchen',     image: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=400&h=160&fit=crop' },
  { id: 16, title: 'Nintendo Switch OLED',             price: 349.99, category: 'Electronics', image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400&h=160&fit=crop' },
  { id: 17, title: 'Theragun Prime Massager',         price: 299.00, category: 'Health',      image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=160&fit=crop' },
  { id: 18, title: 'Catan Board Game',                price: 54.99,  category: 'Toys',        image: 'https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=400&h=160&fit=crop' },
  { id: 19, title: 'Allbirds Tree Runners',           price: 98.00,  category: 'Shoes',       image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=160&fit=crop' },
  { id: 20, title: 'Yeti Rambler 30oz Tumbler',       price: 38.00,  category: 'Outdoor',     image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=160&fit=crop' },
];

const Home: NextPage = () => (
  <>
    <Head>
      <title>Loctary Wishlist</title>
    </Head>
    <Container size="xl" py="xl">
      <Title order={2} mb={4}>
        Discover
      </Title>
      <Text c="dimmed" mb="xl" size="sm">
        Browse items and save the ones you love.
      </Text>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="md">
        {MOCK_ITEMS.map((item) => (
          <WishlistCard key={item.id} {...item} />
        ))}
      </SimpleGrid>
    </Container>
  </>
);

export default Home;
