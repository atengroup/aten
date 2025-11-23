export default function ThemeCard({ theme }) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition overflow-hidden">
      <img
        src={theme.img}
        alt={theme.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="text-lg font-semibold">{theme.name}</h3>
        <p className="text-sm text-gray-600 mt-1">{theme.desc}</p>
      </div>
    </div>
  );
}
