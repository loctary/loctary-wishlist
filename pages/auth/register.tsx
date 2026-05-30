import { Center, Loader } from '@mantine/core';
import type { NextPageWithLayout } from '../_app';
import dynamic from 'next/dynamic';
import Head from 'next/head';

const RegisterPage = dynamic(
  async () => {
    const mod = await import('loctary_auth/RegisterPage');
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

const RegisterRoute: NextPageWithLayout = () => (
  <>
    <Head>
      <title>Create account – Loctary</title>
    </Head>
    <RegisterPage />
  </>
);

export default RegisterRoute;
