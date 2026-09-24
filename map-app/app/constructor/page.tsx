import type {Metadata} from 'next';
import ConstructorClient from './ConstructorClient';

export const metadata: Metadata = {
  title: 'Modal layout editor — Distributor Map',
};

export default function ConstructorPage() {
  return <ConstructorClient />;
}
