import { useParams } from "react-router-dom";
import ContactForm from "../components/ContactForm";

export default function Details() {
  const { type, themeId } = useParams();
  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <img
          src={`/img${themeId}.jpg`}
          alt="Theme"
          className="rounded-xl shadow"
        />
        <div>
          <h2 className="text-2xl font-semibold mb-4">
            {type.toUpperCase()} - Theme #{themeId}
          </h2>
          <p className="text-gray-600 mb-6">
            Beautifully designed interiors with a perfect balance of comfort
            and aesthetics.
          </p>
          <ContactForm homeType={type} themeId={themeId} />
        </div>
      </div>
    </div>
  );
}
