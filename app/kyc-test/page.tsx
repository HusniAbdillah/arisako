import KycForm from "../../components/kycform";

export default function KycTestPage() {
  return (
    <main className="min-h-screen p-6 bg-white text-black">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">KYC Test Page</h1>
        <KycForm />
      </div>
    </main>
  );
}
