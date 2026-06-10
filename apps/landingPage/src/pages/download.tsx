import { DefaultLayout } from '@/components/defaultLayout';
import { F2aHead } from '@/components/head';

export default function Download() {
  return (
    <>
      <F2aHead
        title="Get First 2 Fetch"
        description="Download a published First 2 Fetch release or build the open-source desktop app locally."
        path="/download"
      />
      <DefaultLayout>
        <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center px-5 py-20 text-center sm:px-8">
          <h1 className="text-balance text-5xl font-black tracking-[-0.04em] text-[#102744] sm:text-6xl">
            Get First 2 Fetch
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Published installers are listed on GitHub Releases. Developers can also clone the repository and run the
            Electron app locally.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="https://github.com/i0x1/First2Fetch/releases"
              className="rounded-md bg-[#81966b] px-5 py-3 font-bold text-white"
            >
              View releases
            </a>
            <a
              href="https://github.com/i0x1/First2Fetch#quick-start"
              className="rounded-md border border-[#81966b] px-5 py-3 font-bold text-[#5f744c]"
            >
              Build from source
            </a>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-sm leading-6 text-slate-500">
            Only install binaries published by this repository. Release availability and supported platforms can vary by
            version.
          </p>
        </section>
      </DefaultLayout>
    </>
  );
}
