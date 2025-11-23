import { useState } from "react";
import axios from "axios";

export default function ContactForm({ homeType, themeId }) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/enquiries", { ...form, homeType, themeId });
      setSent(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (sent)
    return <p className="text-green-600 font-medium mt-4">Thank you! We'll contact you soon.</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input name="name" placeholder="Your Name" onChange={handleChange}
        className="w-full border p-2 rounded-lg" required />
      <input name="phone" placeholder="Phone Number" onChange={handleChange}
        className="w-full border p-2 rounded-lg" required />
      <input name="city" placeholder="City" onChange={handleChange}
        className="w-full border p-2 rounded-lg" required />
      <button type="submit"
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
        Get Quote
      </button>
    </form>
  );
}
