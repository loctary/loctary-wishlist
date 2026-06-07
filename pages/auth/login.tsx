import { Center, Loader } from '@mantine/core';
import type { NextPageWithLayout } from '../_app';
import dynamic from 'next/dynamic';
import Head from 'next/head';

const LoginPage = dynamic(
  async () => {
    const mod = await import('loctary_auth/LoginPage');
    return mod;
  },
  {
    ssr: false,
    loading: () => (
      <Center h="70vh">
        <Loader />
      </Center>
    ),
  }
);

const LoginRoute: NextPageWithLayout = () => (
  <>
    <Head>
      <title>Sign in – Loctary</title>
    </Head>
    <LoginPage />
  </>
);

export default LoginRoute;
