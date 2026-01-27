import { BenefitsSection } from '@/components/benefitsSection';
import { BottomCta } from '@/components/bottomCta';
import { DefaultLayout } from '@/components/defaultLayout';
import { ExplainerSection } from '@/components/explainerSection';
import { F2aHead } from '@/components/head';
import { ProductSection } from '@/components/productSection';

export default function Home() {
  return (
    <>
      <F2aHead
        title="First 2 Fetch - Job Board Aggregator"
        description="First 2 Fetch is an upgraded version of First 2 Apply with database performance optimizations, enhanced query functions, and improved timezone handling."
        path="/"
      />

      <DefaultLayout>
        <ProductSection />
        <ExplainerSection />
        <BenefitsSection />
        <BottomCta />
      </DefaultLayout>
    </>
  );
}
