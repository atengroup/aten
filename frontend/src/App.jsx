import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import InterioHome from "./pages/InterioHome";
import Home from "./pages/Home";
import HomeEnquiry from "./pages/HomeEnquiry.jsx";
import Details from "./pages/Details";
import Enquiry from "./pages/Enquiry";
import Header from "./components/Header";
import Footer from "./components/Footer";
import PhoneLoginModal from "./components/PhoneLogin";
import { Toaster } from "react-hot-toast";
import DashboardLayout from "./pages/admin/DashboardLayout";
import BathroomEnquiry from "./pages/BathroomEnquiry.jsx";
// 👉 Import new Realty pages
import ProjectsList from "./pages/ProjectsList";
import ProjectDetail from "./pages/ProjectDetails";
import ProjectsAdmin from "./pages/admin/ProjectsAdmin";
import ProjectForm from "./pages/admin/ProjectForm";
import ImportProjects from "./pages/admin/ImportProjects";
import EnquiriesAdmin from "./pages/admin/EnquiriesAdmin";
import AdminGuard from "./components/AdminGuard";
import RequireAuth from "./components/RequireAuth";
import AddAdmin from "./pages/admin/AddAdmin.jsx";
import TestimonialsAdmin from "./pages/admin/TestimonialsAdmin.jsx";
import SubmitTestimonial from "./pages/SubmitTestimonial.jsx";
import KitchenEnquiry from "./pages/KitchenEnquiry.jsx";
import WardrobeEnquiry from "./pages/WardrobeEnquiry.jsx";
import CustomEnquiry from "./pages/CustomEnquiries.jsx";

export default function App() {
  return (
    <Router>
      <div style={{ background: '#faf9f6'}}>
        <Toaster position="top-center" />
        <Header />

        <Routes>
          {/* --- Public routes --- */}
          <Route path="/" element={<Home />} />
          <Route path="/interio" element={<InterioHome />} />
          <Route path="/home/:type" element={<HomeEnquiry />} />
          <Route path="/kitchen" element={<KitchenEnquiry />} />
          <Route path="/bathroom" element={<BathroomEnquiry />} />
          <Route path="/wardrobe" element={<WardrobeEnquiry />} />
          <Route path="/custom" element={<CustomEnquiry />} />
          <Route path="/details/:type/:themeId" element={<Details />} />
          <Route path="/testimonials" element={<SubmitTestimonial />} />
          <Route
            path="/enquiry"
            element={
              <RequireAuth>
                <Enquiry />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<PhoneLoginModal />} />

          {/* --- Realty / Projects section --- */}
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />

          {/* --- Admin routes --- */}
          <Route
            path="/admin"
            element={
              <AdminGuard><DashboardLayout /></AdminGuard>}
          >
            <Route path="addadmins" element={<AddAdmin />} />
            <Route path="enquiries" element={<AdminGuard><EnquiriesAdmin /></AdminGuard>} />
            <Route path="import" element={<AdminGuard><ImportProjects /></AdminGuard>} />
            <Route path="testimonials" element={<AdminGuard><TestimonialsAdmin /></AdminGuard>} />
            <Route path="projects" element={<AdminGuard><ProjectsAdmin /></AdminGuard>} />
            <Route path="projects/new" element={<AdminGuard><ProjectForm /></AdminGuard>} />
            <Route path="projects/:id" element={<AdminGuard><ProjectForm /></AdminGuard>} />
            {/* other admin nested routes here */}
          </Route>
        </Routes>

        <Footer />
      </div>
    </Router>
  );
}
