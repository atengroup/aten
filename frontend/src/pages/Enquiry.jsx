import ContactForm from "../components/ContactForm";

export default function Enquiry() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4 text-center">
      <h2 className="text-3xl font-bold mb-6">Custom Enquiry for 3+ BHK Homes</h2>
      <p className="text-gray-600 mb-8">
        Tell us a bit about your space and requirements, and our team will reach out with a personalized quote.
      </p>
      <div className="max-w-md mx-auto">
        <ContactForm homeType="3+BHK" />
      </div>
    </div>
  );
}
