import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { PublicLayout } from './components/public/PublicLayout'
import { LoginPage } from './pages/admin/LoginPage'
import { useAuthStore } from './stores/authStore'
import { usePublicAuthStore } from './stores/publicAuthStore'
import { isAdminRole } from './lib/permissions'
import { ToastProvider } from './components/ui/toast'

const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const ReservationsPage = lazy(() => import('./pages/admin/ReservationsPage'))
const CheckInPage = lazy(() => import('./pages/admin/CheckInPage'))
const CheckOutPage = lazy(() => import('./pages/admin/CheckOutPage'))
const GuestsPage = lazy(() => import('./pages/admin/GuestsPage'))
const RoomsPage = lazy(() => import('./pages/admin/RoomsPage'))
const RoomListPage = lazy(() => import('./pages/admin/RoomListPage'))
const HousekeepingPage = lazy(() => import('./pages/admin/HousekeepingPage'))
const MaintenancePage = lazy(() => import('./pages/admin/MaintenancePage'))
const StaffPage = lazy(() => import('./pages/admin/StaffPage'))
const InvoicesPage = lazy(() => import('./pages/admin/InvoicesPage'))
const PaymentsPage = lazy(() => import('./pages/admin/PaymentsPage'))
const ExpensesPage = lazy(() => import('./pages/admin/ExpensesPage'))
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'))
const InquiriesPage = lazy(() => import('./pages/admin/InquiriesPage'))
const ActivityLogsPage = lazy(() => import('./pages/admin/ActivityLogsPage'))
const ProfilePage = lazy(() => import('./pages/admin/ProfilePage'))
const RoomTypesPage = lazy(() => import('./pages/admin/RoomTypesPage'))
const AmenitiesPage = lazy(() => import('./pages/admin/AmenitiesPage'))
const RoomImagesPage = lazy(() => import('./pages/admin/RoomImagesPage'))

const PublicHomePage = lazy(() => import('./pages/public/PublicHomePage'))
const PublicRoomsPage = lazy(() => import('./pages/public/PublicRoomsPage'))
const PublicRoomDetailPage = lazy(() => import('./pages/public/PublicRoomDetailPage'))
const PublicBookingPage = lazy(() => import('./pages/public/PublicBookingPage'))
const PublicLoginPage = lazy(() => import('./pages/public/PublicLoginPage'))
const PublicRegisterPage = lazy(() => import('./pages/public/PublicRegisterPage'))
const PublicMyReservationsPage = lazy(() => import('./pages/public/PublicMyReservationsPage'))
const PublicProfilePage = lazy(() => import('./pages/public/PublicProfilePage'))
const PublicGalleryPage = lazy(() => import('./pages/public/PublicGalleryPage'))
const PublicContactPage = lazy(() => import('./pages/public/PublicContactPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

function RequireRole({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/admin/login" replace />
  if (!isAdminRole(user?.role)) return <Navigate to="/admin/dashboard" replace />
  return <>{children}</>
}

function ProtectedPublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = usePublicAuthStore()
  if (!token) return <Navigate to="/public/login" replace />
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    function handleUnauthorized() {
      navigate('/admin/login', { replace: true })
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [navigate])

  return (
    <ToastProvider>
      <Routes>
        {/* Guest portal at root */}
        <Route path="/" element={
          <Suspense fallback={<PageLoader />}><PublicLayout /></Suspense>
        }>
          <Route index element={<Suspense fallback={<PageLoader />}><PublicHomePage /></Suspense>} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
          <Route path="reservations" element={<Suspense fallback={<PageLoader />}><ReservationsPage /></Suspense>} />
          <Route path="check-in" element={<Suspense fallback={<PageLoader />}><CheckInPage /></Suspense>} />
          <Route path="check-out" element={<Suspense fallback={<PageLoader />}><CheckOutPage /></Suspense>} />
          <Route path="guests" element={<Suspense fallback={<PageLoader />}><GuestsPage /></Suspense>} />
          <Route path="rooms" element={<Suspense fallback={<PageLoader />}><RoomsPage /></Suspense>} />
          <Route path="room-list" element={<Suspense fallback={<PageLoader />}><RoomListPage /></Suspense>} />
          <Route path="room-types" element={<RequireRole><Suspense fallback={<PageLoader />}><RoomTypesPage /></Suspense></RequireRole>} />
          <Route path="amenities" element={<RequireRole><Suspense fallback={<PageLoader />}><AmenitiesPage /></Suspense></RequireRole>} />
          <Route path="room-images" element={<RequireRole><Suspense fallback={<PageLoader />}><RoomImagesPage /></Suspense></RequireRole>} />
          <Route path="housekeeping" element={<Suspense fallback={<PageLoader />}><HousekeepingPage /></Suspense>} />
          <Route path="maintenance" element={<Suspense fallback={<PageLoader />}><MaintenancePage /></Suspense>} />
          <Route path="staff" element={<RequireRole><Suspense fallback={<PageLoader />}><StaffPage /></Suspense></RequireRole>} />
          <Route path="invoices" element={<Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<PageLoader />}><PaymentsPage /></Suspense>} />
          <Route path="expenses" element={<RequireRole><Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense></RequireRole>} />
          <Route path="reports" element={<RequireRole><Suspense fallback={<PageLoader />}><ReportsPage /></Suspense></RequireRole>} />
          <Route path="inquiries" element={<RequireRole><Suspense fallback={<PageLoader />}><InquiriesPage /></Suspense></RequireRole>} />
          <Route path="activity-logs" element={<RequireRole><Suspense fallback={<PageLoader />}><ActivityLogsPage /></Suspense></RequireRole>} />
          <Route path="settings" element={<RequireRole><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></RequireRole>} />
          <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
        </Route>

        {/* Guest Public routes */}
        <Route path="/public" element={
          <Suspense fallback={<PageLoader />}><PublicLayout /></Suspense>
        }>
          <Route index element={<Suspense fallback={<PageLoader />}><PublicHomePage /></Suspense>} />
          <Route path="rooms" element={<Suspense fallback={<PageLoader />}><PublicRoomsPage /></Suspense>} />
          <Route path="rooms/:slug" element={<Suspense fallback={<PageLoader />}><PublicRoomDetailPage /></Suspense>} />
          <Route path="book" element={
            <ProtectedPublicRoute><Suspense fallback={<PageLoader />}><PublicBookingPage /></Suspense></ProtectedPublicRoute>
          } />
          <Route path="my-reservations" element={
            <ProtectedPublicRoute><Suspense fallback={<PageLoader />}><PublicMyReservationsPage /></Suspense></ProtectedPublicRoute>
          } />
          <Route path="profile" element={
            <ProtectedPublicRoute><Suspense fallback={<PageLoader />}><PublicProfilePage /></Suspense></ProtectedPublicRoute>
          } />
          <Route path="gallery" element={<Suspense fallback={<PageLoader />}><PublicGalleryPage /></Suspense>} />
          <Route path="contact" element={<Suspense fallback={<PageLoader />}><PublicContactPage /></Suspense>} />
        </Route>
        <Route path="/public/login" element={<Suspense fallback={<PageLoader />}><PublicLoginPage /></Suspense>} />
        <Route path="/public/register" element={<Suspense fallback={<PageLoader />}><PublicRegisterPage /></Suspense>} />
      </Routes>
    </ToastProvider>
  )
}