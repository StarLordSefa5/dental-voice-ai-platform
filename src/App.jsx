import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { 
  Clock, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Users, 
  MessageSquare, 
  Check, 
  Ban, 
  CalendarCheck,
  Stethoscope,
  Plus, 
  X,
  Lock,
  LogOut,
  ShieldCheck,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const PIN_CODES = {
  resepsiyon: '1234',
  emre: '1111',
  zeynep: '2222'
};

// Doktorların Cal.com Etkinlik Türü (Event Type) ID Eşleşmesi
const CAL_EVENT_TYPE_IDS = {
  zeynep: 7163855,
  emre: 7285787
};

const CAL_API_KEY = import.meta.env.VITE_CAL_API_KEY;

// Klinik Çalışma Saatleri (30 dk aralıklarla)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('dental_clinic_user') || null;
  });

  const [selectedRole, setSelectedRole] = useState('resepsiyon');
  const [enteredPin, setEnteredPin] = useState('');
  const [loginError, setLoginError] = useState('');

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeDoctorFilter, setActiveDoctorFilter] = useState('all');

  // Görünüm Modu: 'table' (Liste) veya 'calendar' (Doktor Takvimi)
  const [viewMode, setViewMode] = useState('table');

  // Takvim Görünümü Seçimleri
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [calendarDoctor, setCalendarDoctor] = useState('zeynep');

  // Manuel Randevu Modal Durumu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    isim: '',
    soyisim: '',
    telefon: '',
    email: '',
    tarih: '',
    saat: '10:00',
    doktor: 'zeynep',
    randevu_notu: ''
  });

  // İptal Onay Pop-up Durumu
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (enteredPin === PIN_CODES[selectedRole]) {
      localStorage.setItem('dental_clinic_user', selectedRole);
      setCurrentUser(selectedRole);
      setEnteredPin('');
      setLoginError('');
      if (selectedRole === 'emre' || selectedRole === 'zeynep') {
        setCalendarDoctor(selectedRole);
      }
    } else {
      setLoginError('Hatalı PIN kodu! Lütfen tekrar deneyin.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dental_clinic_user');
    setCurrentUser(null);
    setEnteredPin('');
  };

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      console.warn('Ses çalınamadı:', e);
    }
  };

  const assignDoctor = (app) => {
    if (app.doktor) {
      const doc = app.doktor.replace(/İ/g, 'i').toLocaleLowerCase('tr-TR');
      if (doc.includes('emre')) return 'emre';
      if (doc.includes('zeynep')) return 'zeynep';
    }
    const note = (app.randevu_notu || '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLocaleLowerCase('tr-TR');

    if (
      note.includes('implant') || 
      note.includes('cerrahi') || 
      note.includes('protez') ||
      note.includes('20lik') ||
      note.includes('gömülü')
    ) {
      return 'emre';
    }
    return 'zeynep';
  };

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from('randevular')
      .select('*')
      .order('tarih', { ascending: false });

    if (!error && data) {
      setAppointments(data);
    }
    setLoading(false);
  };

  // Cal.com v2 üzerinden randevu oluşturma
  const createCalComBooking = async ({ isim, soyisim, telefon, email, startIso, doctorKey }) => {
    if (!CAL_API_KEY) {
      console.warn('Cal API Key bulunamadı');
      return null;
    }

    const cleanKey = CAL_API_KEY.replace('Bearer ', '').trim();
    const eventTypeId = CAL_EVENT_TYPE_IDS[doctorKey] || CAL_EVENT_TYPE_IDS.zeynep;
    const cleanDigits = telefon.replace(/\D/g, '');
    
    const attendeeEmail = email && email.trim() !== '' && email.includes('@')
      ? email.trim() 
      : `randevu.${cleanDigits || 'hasta'}@gmail.com`;

    const cleanPhone = telefon.startsWith('+') ? telefon : `+90${cleanDigits.replace(/^0/, '')}`;

    try {
      const response = await fetch('/cal-api/v2/bookings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'cal-api-version': '2024-08-13',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          start: startIso,
          eventTypeId: Number(eventTypeId),
          attendee: {
            name: `${isim} ${soyisim}`.trim(),
            email: attendeeEmail,
            timeZone: 'Europe/Istanbul',
            phoneNumber: cleanPhone
          }
        })
      });

      const resData = await response.json().catch(() => ({}));
      console.log('Cal.com Oluşturma Yanıtı:', response.status, resData);

      if (response.ok && resData) {
        const bookingUid = resData.data?.uid || resData.uid || (resData.data?.id ? String(resData.data.id) : null);
        return bookingUid;
      } else {
        console.warn('Cal.com randevusu takvime eklenemedi:', resData);
        return null;
      }
    } catch (err) {
      console.error('Cal.com API oluşturma hatası:', err);
      return null;
    }
  };

  // Cal.com v2 üzerinden randevuyu iptal edip saati boşa çıkarma
  const cancelCalComBooking = async (bookingUid) => {
    if (!bookingUid || !CAL_API_KEY) {
      console.warn('Booking UID veya Cal API Key bulunamadı:', { bookingUid, hasKey: !!CAL_API_KEY });
      return;
    }

    const cleanKey = CAL_API_KEY.replace('Bearer ', '').trim();

    try {
      const response = await fetch(`/cal-api/v2/bookings/${bookingUid}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'cal-api-version': '2024-08-13',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cancellationReason: 'Panel üzerinden sekreter tarafından iptal edildi'
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (response.ok) {
        console.log('Cal.com randevusu başarıyla silindi ve saat boşa çıkarıldı:', bookingUid);
      } else {
        console.error('Cal.com iptal reddedildi:', resData);
      }
    } catch (err) {
      console.error('Cal.com API isteğinde hata:', err);
    }
  };

  const handleUpdateStatus = async (app, newStatus) => {
    const { error } = await supabase
      .from('randevular')
      .update({ durum: newStatus })
      .eq('id', app.id);

    if (error) {
      alert('Randevu durumu güncellenemedi: ' + error.message);
      return;
    }

    if (newStatus === 'iptal_edildi' && app.cal_booking_id) {
      await cancelCalComBooking(app.cal_booking_id);
    }
  };

  const confirmCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);
    await handleUpdateStatus(appointmentToCancel, 'iptal_edildi');
    setIsCancelling(false);
    setAppointmentToCancel(null);
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!formData.isim || !formData.telefon || !formData.tarih) {
      alert('Lütfen ad, telefon ve tarih alanlarını doldurunuz.');
      return;
    }

    setIsSubmitting(true);
    const combinedDateTime = new Date(`${formData.tarih}T${formData.saat}:00`).toISOString();
    const targetDoc = currentUser === 'emre' ? 'emre' : currentUser === 'zeynep' ? 'zeynep' : formData.doktor;

    const calBookingId = await createCalComBooking({
      isim: formData.isim,
      soyisim: formData.soyisim,
      telefon: formData.telefon,
      email: formData.email,
      startIso: combinedDateTime,
      doctorKey: targetDoc
    });

    const { error } = await supabase.from('randevular').insert([
      {
        isim: formData.isim.trim(),
        soyisim: formData.soyisim.trim(),
        telefon: formData.telefon.trim(),
        tarih: combinedDateTime,
        randevu_notu: formData.randevu_notu.trim() || 'Genel Diş Muayenesi',
        doktor: targetDoc,
        cal_booking_id: calBookingId || null,
        durum: 'onaylandi',
        kaynak: 'panel_manuel'
      }
    ]);

    setIsSubmitting(false);

    if (error) {
      alert('Supabase Kayıt Hatası: ' + error.message);
    } else {
      setIsModalOpen(false);
      setFormData({
        isim: '',
        soyisim: '',
        telefon: '',
        email: '',
        tarih: '',
        saat: '10:00',
        doktor: 'zeynep',
        randevu_notu: ''
      });
    }
  };

  // Takvimden boş saate tıklayınca modalı o saatle açma
  const handleQuickBookSlot = (slotTime) => {
    const activeDoc = currentUser === 'emre' ? 'emre' : currentUser === 'zeynep' ? 'zeynep' : calendarDoctor;
    setFormData({
      isim: '',
      soyisim: '',
      telefon: '',
      email: '',
      tarih: selectedCalendarDate,
      saat: slotTime,
      doktor: activeDoc,
      randevu_notu: ''
    });
    setIsModalOpen(true);
  };

  const changeCalendarDateByDays = (days) => {
    const d = new Date(selectedCalendarDate);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedCalendarDate(`${y}-${m}-${day}`);
  };

  useEffect(() => {
    fetchAppointments();

    const channel = supabase
      .channel('randevular-canli')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'randevular' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const targetDoctor = assignDoctor(payload.new);
            if (currentUser === 'resepsiyon' || currentUser === targetDoctor) {
              playAlertSound();
            }
            setAppointments((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const targetDoctor = assignDoctor(payload.new);
            if (payload.new.durum === 'gecikmeli' && (currentUser === 'resepsiyon' || currentUser === targetDoctor)) {
              playAlertSound();
            }
            setAppointments((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setAppointments((prev) =>
              prev.filter((item) => item.id === payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const formatDateTime = (dateString) => {
    if (!dateString) return { tarih: '-', saat: '-' };
    const date = new Date(dateString);
    return {
      tarih: date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
      saat: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      ymd: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    };
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100">
        <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Klinik Giriş Paneli</h2>
            <p className="text-xs text-slate-400">Yetkili ekranına erişmek için rolünüzü seçip PIN kodunu giriniz</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Giriş Yapılacak Ekran</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedRole('resepsiyon'); setLoginError(''); }}
                  className={`py-2 px-1 text-xs font-medium rounded-xl border transition ${
                    selectedRole === 'resepsiyon' 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                      : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Resepsiyon
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedRole('emre'); setLoginError(''); }}
                  className={`py-2 px-1 text-xs font-medium rounded-xl border transition ${
                    selectedRole === 'emre' 
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md' 
                      : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Dr. Emre
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedRole('zeynep'); setLoginError(''); }}
                  className={`py-2 px-1 text-xs font-medium rounded-xl border transition ${
                    selectedRole === 'zeynep' 
                      ? 'bg-sky-600 border-sky-500 text-white shadow-md' 
                      : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Dr. Zeynep
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">4 Haneli Güvenlik PIN Kodu</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input 
                  type="password" 
                  maxLength={4}
                  autoFocus
                  required
                  placeholder="••••" 
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-center text-lg tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Demo PIN: Resepsiyon (1234) • Dr. Emre (1111) • Dr. Zeynep (2222)
              </p>
            </div>

            {loginError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-600/20"
            >
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  const accessibleAppointments = appointments.filter((app) => {
    const doc = assignDoctor(app);
    if (currentUser === 'emre') return doc === 'emre';
    if (currentUser === 'zeynep') return doc === 'zeynep';
    if (activeDoctorFilter === 'all') return true;
    return doc === activeDoctorFilter;
  });

  const totalCount = accessibleAppointments.length;
  const confirmedCount = accessibleAppointments.filter(a => a.durum === 'onaylandi').length;
  const delayedCount = accessibleAppointments.filter(a => a.durum === 'gecikmeli').length;
  const completedCount = accessibleAppointments.filter(a => a.durum === 'tamamlandi').length;
  const cancelledCount = accessibleAppointments.filter(a => a.durum === 'iptal_edildi' || a.durum === 'iptal').length;

  const filteredAppointments = accessibleAppointments.filter((app) => {
    const fullName = `${app.isim || ''} ${app.soyisim || ''}`.toLowerCase();
    const phone = app.telefon || '';
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || app.durum === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Takvim Görünümü İçin Seçili Doktor ve Gün Randevuları
  const currentCalDoctor = currentUser === 'emre' ? 'emre' : currentUser === 'zeynep' ? 'zeynep' : calendarDoctor;
  const activeDayAppointments = appointments.filter((app) => {
    if (app.durum === 'iptal_edildi' || app.durum === 'iptal') return false;
    const doc = assignDoctor(app);
    if (doc !== currentCalDoctor) return false;
    const dt = formatDateTime(app.tarih);
    return dt.ymd === selectedCalendarDate;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Üst Başlık & Kullanıcı Barı */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {currentUser === 'emre' && 'Dr. Emre Bey | İmplant & Cerrahi Odası'}
              {currentUser === 'zeynep' && 'Dr. Zeynep Hanım | Genel Muayene Odası'}
              {currentUser === 'resepsiyon' && 'Diş Kliniği Ana Resepsiyon Paneli'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {currentUser === 'resepsiyon' 
                ? 'Tüm doktorların canlı randevu akışı ve genel klinik yönetimi' 
                : 'Yalnızca odanıza atanmış canlı hasta ve randevu listesi (İzole Ekran)'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Görünüm Değiştirici: Liste vs Takvim */}
            <div className="bg-slate-200/80 p-1 rounded-xl flex gap-1 text-xs font-semibold shadow-inner">
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Liste
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Doktor Takvimi
              </button>
            </div>

            <button
              onClick={() => {
                setFormData({
                  isim: '',
                  soyisim: '',
                  telefon: '',
                  email: '',
                  tarih: selectedCalendarDate,
                  saat: '10:00',
                  doktor: currentCalDoctor,
                  randevu_notu: ''
                });
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Yeni Randevu
            </button>

            {currentUser === 'resepsiyon' && viewMode === 'table' && (
              <div className="bg-slate-200/70 p-1 rounded-xl flex gap-1 text-xs font-medium">
                <button
                  onClick={() => setActiveDoctorFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeDoctorFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setActiveDoctorFilter('emre')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeDoctorFilter === 'emre' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dr. Emre
                </button>
                <button
                  onClick={() => setActiveDoctorFilter('zeynep')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    activeDoctorFilter === 'zeynep' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dr. Zeynep
                </button>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 hover:border-red-200 transition"
              title="Oturumu kapat ve ekranı kilitle"
            >
              <LogOut className="w-3.5 h-3.5" />
              Kilitle
            </button>
          </div>
        </div>

        {/* Sayaç Kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Toplam Randevu</p>
                <h3 className="text-xl font-bold text-slate-900">{totalCount}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Onaylı</p>
                <h3 className="text-xl font-bold text-slate-900">{confirmedCount}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Gecikenler</p>
                <h3 className="text-xl font-bold text-slate-900">{delayedCount}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg"><CalendarCheck className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Tedavi Bitti</p>
                <h3 className="text-xl font-bold text-slate-900">{completedCount}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg"><XCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">İptaller</p>
                <h3 className="text-xl font-bold text-slate-900">{cancelledCount}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* 1. GÖRÜNÜM: DOKTOR TAKVİMİ / AJANDASI */}
        {viewMode === 'calendar' ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Takvim Üst Kontrol Barı */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Doktor Seçimi (Resepsiyon ise aktif) */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Takvim:</span>
                {currentUser === 'resepsiyon' ? (
                  <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                    <button
                      onClick={() => setCalendarDoctor('zeynep')}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                        calendarDoctor === 'zeynep' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Dr. Zeynep Hanım (Genel)
                    </button>
                    <button
                      onClick={() => setCalendarDoctor('emre')}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                        calendarDoctor === 'emre' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Dr. Emre Bey (İmplant)
                    </button>
                  </div>
                ) : (
                  <span className="font-bold text-sm text-slate-800 px-3 py-1.5 bg-slate-100 rounded-lg">
                    {currentUser === 'emre' ? 'Dr. Emre Bey' : 'Dr. Zeynep Hanım'}
                  </span>
                )}
              </div>

              {/* Gün Gezgini */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeCalendarDateByDays(-1)}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                  title="Önceki Gün"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <input 
                  type="date"
                  value={selectedCalendarDate}
                  onChange={(e) => setSelectedCalendarDate(e.target.value)}
                  className="px-3 py-1.5 text-sm font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={() => changeCalendarDateByDays(1)}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                  title="Sonraki Gün"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const d = String(now.getDate()).padStart(2, '0');
                    setSelectedCalendarDate(`${y}-${m}-${d}`);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  Bugün
                </button>
              </div>

              {/* Günlük Özet */}
              <div className="text-xs font-medium text-slate-500">
                Bu tarihte <strong className="text-slate-900">{activeDayAppointments.length}</strong> dolu randevu var
              </div>
            </div>

            {/* Günlük Saat Çizelgesi */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-2.5">
              {TIME_SLOTS.map((slot) => {
                // Bu saat dilimine denk gelen aktif randevu var mı?
                const matchedApp = activeDayAppointments.find((app) => {
                  const dt = formatDateTime(app.tarih);
                  return dt.saat.startsWith(slot);
                });

                if (matchedApp) {
                  const isCompleted = matchedApp.durum === 'tamamlandi';
                  const isDelayed = matchedApp.durum === 'gecikmeli';

                  return (
                    <div 
                      key={slot}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border transition ${
                        isCompleted 
                          ? 'bg-slate-50 border-slate-200 opacity-70' 
                          : isDelayed
                          ? 'bg-amber-50/80 border-amber-200'
                          : 'bg-blue-50/60 border-blue-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-slate-700 w-14">
                          {slot}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {matchedApp.isim} {matchedApp.soyisim}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">({matchedApp.telefon})</span>
                          <span className="text-xs text-slate-600 font-medium px-2 py-0.5 bg-white/80 rounded border border-slate-200">
                            {matchedApp.randevu_notu}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        {isCompleted ? (
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-md">
                            Tamamlandı
                          </span>
                        ) : isDelayed ? (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                            Gecikmeli
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md">
                            Dolu / Rezerve
                          </span>
                        )}

                        {!isCompleted && (
                          <button
                            onClick={() => setAppointmentToCancel(matchedApp)}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition"
                            title="İptal Et"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // Boş Saat
                return (
                  <div 
                    key={slot}
                    className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-slate-400 group-hover:text-slate-700 transition w-14">
                        {slot}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Müsait (Boş)
                      </span>
                    </div>

                    <button
                      onClick={() => handleQuickBookSlot(slot)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Randevu Ver
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 2. GÖRÜNÜM: KLASİK TABLO GÖRÜNÜMÜ */
          <div className="space-y-4">
            {/* Kontrol Çubuğu */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Hasta adı veya telefon ara..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                {['all', 'onaylandi', 'gecikmeli', 'tamamlandi', 'iptal_edildi'].map((filterKey) => {
                  const labels = {
                    all: 'Tümü',
                    onaylandi: 'Onaylananlar',
                    gecikmeli: 'Gecikenler',
                    tamamlandi: 'Tamamlananlar',
                    iptal_edildi: 'İptal Edilenler'
                  };
                  return (
                    <button
                      key={filterKey}
                      onClick={() => setStatusFilter(filterKey)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        statusFilter === filterKey ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {labels[filterKey]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Randevu Tablosu */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-500">Randevular yükleniyor...</div>
              ) : filteredAppointments.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Stethoscope className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Bu ekranda kayıtlı randevu bulunamadı.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold">
                        <th className="py-3.5 px-6">Hasta Bilgisi</th>
                        {currentUser === 'resepsiyon' && <th className="py-3.5 px-6">İlgili Doktor</th>}
                        <th className="py-3.5 px-6">İletişim</th>
                        <th className="py-3.5 px-6">Randevu Zamanı</th>
                        <th className="py-3.5 px-6">İşlem / Tedavi</th>
                        <th className="py-3.5 px-6">Durum</th>
                        <th className="py-3.5 px-6 text-right">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAppointments.map((app) => {
                        const dt = formatDateTime(app.tarih);
                        const isDelayed = app.durum === 'gecikmeli';
                        const isCancelled = app.durum === 'iptal_edildi' || app.durum === 'iptal';
                        const isCompleted = app.durum === 'tamamlandi';
                        const doctorTag = assignDoctor(app);

                        return (
                          <tr 
                            key={app.id || app.telefon} 
                            className={`hover:bg-slate-50 transition-colors ${
                              isDelayed ? 'bg-amber-50/40' : isCancelled ? 'bg-red-50/30' : isCompleted ? 'bg-slate-50/70 opacity-75' : ''
                            }`}
                          >
                            <td className="py-4 px-6 font-medium text-slate-900">
                              {app.isim} {app.soyisim}
                            </td>

                            {currentUser === 'resepsiyon' && (
                              <td className="py-4 px-6">
                                {doctorTag === 'emre' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                    Dr. Emre (İmplant)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                    Dr. Zeynep (Genel)
                                  </span>
                                )}
                              </td>
                            )}

                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 font-mono text-xs">{app.telefon}</span>
                                <a 
                              href={`https://wa.me/90${app.telefon}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700"
                              title="WhatsApp Mesajı"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {dt.saat}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{dt.tarih}</div>
                        </td>
                        <td className="py-4 px-6 max-w-xs truncate text-slate-600 font-medium">
                          {app.randevu_notu || '-'}
                        </td>
                        <td className="py-4 px-6">
                          {isDelayed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Gecikmeli
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                              <XCircle className="w-3 h-3" /> İptal Edildi
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              <CheckCircle2 className="w-3 h-3" /> Tamamlandı
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Onaylandı
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isCompleted && !isCancelled && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(app, 'tamamlandi')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition"
                                  title="Tedavi tamamlandı"
                                >
                                  <Check className="w-3 h-3" /> Tamamla
                                </button>
                                <button
                                  onClick={() => setAppointmentToCancel(app)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition"
                                  title="Randevuyu iptal et"
                                >
                                  <Ban className="w-3 h-3" /> İptal Et
                                </button>
                              </>
                            )}
                            {(isCompleted || isCancelled) && (
                              <span className="text-xs text-slate-400 italic">İşlem Kapandı</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}

    {/* İPTAL GÜVENLİK ONAY MODALI (POP-UP) */}
    {appointmentToCancel && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Randevuyu İptal Et</h3>
              <p className="text-xs text-slate-500">Bu işlem geri alınamaz</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
            <p>
              <strong className="text-slate-900">{appointmentToCancel.isim} {appointmentToCancel.soyisim}</strong> isimli hastanın{' '}
              <span className="font-medium text-slate-900">
                {formatDateTime(appointmentToCancel.tarih).tarih} - {formatDateTime(appointmentToCancel.tarih).saat}
              </span>{' '}
              tarihli randevusunu iptal etmek istediğinize emin misiniz?
            </p>
            <p className="text-amber-700 font-medium">
              • Cal.com takvimindeki saat dilimi anında silinecek ve başka hastalar için tekrar boşa çıkarılacaktır.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isCancelling}
              onClick={() => setAppointmentToCancel(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={isCancelling}
              onClick={confirmCancelAppointment}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg shadow-sm transition"
            >
              {isCancelling ? 'İptal Ediliyor...' : 'Evet, Randevuyu İptal Et'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* MANUEL RANDEVU MODALI (Cal.com + Supabase Entegre) */}
    {isModalOpen && (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Yeni Randevu Kaydı</h3>
              <p className="text-xs text-slate-500">Kayıt anında hem takvime (Cal.com) hem panele işlenecektir</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateAppointment} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hasta Adı *</label>
                <input 
                  type="text"
                  required
                  placeholder="Örn: Ahmet"
                  value={formData.isim}
                  onChange={(e) => setFormData({ ...formData, isim: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Soyadı</label>
                <input 
                  type="text"
                  placeholder="Örn: Yılmaz"
                  value={formData.soyisim}
                  onChange={(e) => setFormData({ ...formData, soyisim: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Telefon Numarası *</label>
                <input 
                  type="tel"
                  required
                  placeholder="5441234567"
                  value={formData.telefon}
                  onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">E-posta (İsteğe Bağlı)</label>
                <input 
                  type="email"
                  placeholder="hasta@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tarih *</label>
                <input 
                  type="date"
                  required
                  value={formData.tarih}
                  onChange={(e) => setFormData({ ...formData, tarih: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Saat</label>
                <input 
                  type="time"
                  value={formData.saat}
                  onChange={(e) => setFormData({ ...formData, saat: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {currentUser === 'resepsiyon' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">İlgili Doktor & Branş *</label>
                <select
                  value={formData.doktor}
                  onChange={(e) => setFormData({ ...formData, doktor: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="zeynep">Dr. Zeynep Hanım (Genel Muayene & Dolgu)</option>
                  <option value="emre">Dr. Emre Bey (İmplant & Cerrahi)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tedavi / Not</label>
              <input 
                type="text"
                placeholder="Örn: 20'lik diş çekimi veya Muayene"
                value={formData.randevu_notu}
                onChange={(e) => setFormData({ ...formData, randevu_notu: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition"
              >
                {isSubmitting ? 'Takvim ve Veritabanına İşleniyor...' : 'Randevuyu Oluştur'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

  </div>
</div>
  );
}