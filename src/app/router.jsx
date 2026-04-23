import { createHashRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import React from 'react';
import { ContractProvider } from '../context/ContractContext';
import { DeployProvider } from '../context/DeployContext';

const WrappedLayout = () => (
  <ContractProvider>
    <DeployProvider>
      <Layout />
    </DeployProvider>
  </ContractProvider>
);

const router = createHashRouter([
  {
    path: '/',
    element: <WrappedLayout />,
    errorElement: <WrappedLayout />,
  },
]);

export default router;
