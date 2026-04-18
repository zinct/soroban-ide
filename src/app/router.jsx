import { createHashRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import React from 'react';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <Layout />,
  },
]);

export default router;
