// services/firebase.js — Safe demo-first version
// Works fully without any Firebase keys using localStorage

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseReady = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "undefined");

let auth = null, db = null;

async function getFirebase() {
  if (!firebaseReady) return { auth: null, db: null };
  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const { getAuth } = await import("firebase/auth");
    const { getFirestore } = await import("firebase/firestore");
    return { auth: getAuth(app), db: getFirestore(app) };
  } catch { return { auth: null, db: null }; }
}

// ── AUTH ──────────────────────────────────────────────────────

export async function signUpWithEmail(name, email, password) {
  if (!firebaseReady) return demoSignUp(name, email);
  try {
    const { auth } = await getFirebase();
    const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
    const { getFirestore, doc, setDoc } = await import("firebase/firestore");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const db = getFirestore();
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid, name, email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0A6EBD&color=fff`,
      preferences: { currency: "USD" }, createdAt: new Date().toISOString(),
    });
    return cred.user;
  } catch { return demoSignUp(name, email); }
}

export async function signInWithEmail(email, password) {
  if (!firebaseReady) return demoSignIn(email);
  try {
    const { auth } = await getFirebase();
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch { return demoSignIn(email); }
}

export async function signInWithGoogle() {
  if (!firebaseReady) return demoSignIn("demo@google.com");
  try {
    const { auth } = await getFirebase();
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    return cred.user;
  } catch { return demoSignIn("demo@google.com"); }
}

export async function logOut() {
  localStorage.removeItem("stm_demo_user");
  if (!firebaseReady) return;
  try {
    const { auth } = await getFirebase();
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  } catch {}
}

export function onAuthChange(callback) {
  if (!firebaseReady) {
    const stored = localStorage.getItem("stm_demo_user");
    setTimeout(() => callback(stored ? JSON.parse(stored) : null), 0);
    return () => {};
  }
  let unsubscribe = () => {};
  getFirebase().then(({ auth }) => {
    if (!auth) { callback(null); return; }
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(auth, callback);
    });
  });
  return () => unsubscribe();
}

export async function getUserProfile(uid) {
  if (!firebaseReady) return getDemoUser();
  try {
    const { db } = await getFirebase();
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : getDemoUser();
  } catch { return getDemoUser(); }
}

// ── TRIPS ─────────────────────────────────────────────────────

export async function saveTrip(uid, tripData) {
  const trip = { ...tripData, id: `trip-${Date.now()}`, userId: uid, createdAt: new Date().toISOString() };
  if (!firebaseReady) {
    const trips = JSON.parse(localStorage.getItem("stm_trips") || "[]");
    trips.unshift(trip);
    localStorage.setItem("stm_trips", JSON.stringify(trips));
    return trip;
  }
  try {
    const { db } = await getFirebase();
    const { collection, addDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, "trips"), trip);
    return { ...trip, id: ref.id };
  } catch {
    const trips = JSON.parse(localStorage.getItem("stm_trips") || "[]");
    trips.unshift(trip);
    localStorage.setItem("stm_trips", JSON.stringify(trips));
    return trip;
  }
}

export async function getUserTrips(uid) {
  if (!firebaseReady) {
    const trips = JSON.parse(localStorage.getItem("stm_trips") || "[]");
    return trips.filter(t => t.userId === uid);
  }
  try {
    const { db } = await getFirebase();
    const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");
    const q = query(collection(db, "trips"), where("userId", "==", uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch {
    const trips = JSON.parse(localStorage.getItem("stm_trips") || "[]");
    return trips.filter(t => t.userId === uid);
  }
}

export async function updateTrip(tripId, updates) {
  const trips = JSON.parse(localStorage.getItem("stm_trips") || "[]");
  const idx = trips.findIndex(t => t.id === tripId);
  if (idx > -1) { trips[idx] = { ...trips[idx], ...updates }; localStorage.setItem("stm_trips", JSON.stringify(trips)); }
  if (!firebaseReady) return;
  try {
    const { db } = await getFirebase();
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "trips", tripId), updates);
  } catch {}
}

export async function deleteTrip(tripId) {
  const trips = JSON.parse(localStorage.getItem("stm_trips") || "[]");
  localStorage.setItem("stm_trips", JSON.stringify(trips.filter(t => t.id !== tripId)));
  if (!firebaseReady) return;
  try {
    const { db } = await getFirebase();
    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "trips", tripId));
  } catch {}
}

// ── BOOKINGS ──────────────────────────────────────────────────

export async function saveBooking(uid, bookingData) {
  const booking = {
    ...bookingData, userId: uid, status: "confirmed",
    bookingRef: `STM${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString()
  };
  const bookings = JSON.parse(localStorage.getItem("stm_bookings") || "[]");
  bookings.unshift(booking);
  localStorage.setItem("stm_bookings", JSON.stringify(bookings));
  if (firebaseReady) {
    try {
      const { db } = await getFirebase();
      const { collection, addDoc } = await import("firebase/firestore");
      const ref = await addDoc(collection(db, "bookings"), booking);
      return { ...booking, id: ref.id };
    } catch {}
  }
  return booking;
}

export async function getUserBookings(uid) {
  const bookings = JSON.parse(localStorage.getItem("stm_bookings") || "[]");
  const local = bookings.filter(b => b.userId === uid);
  if (!firebaseReady) return local;
  try {
    const { db } = await getFirebase();
    const { collection, query, where, getDocs, orderBy } = await import("firebase/firestore");
    const q = query(collection(db, "bookings"), where("userId", "==", uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch { return local; }
}

// ── REVIEWS ───────────────────────────────────────────────────

export async function saveReview(uid, reviewData) {
  const review = { ...reviewData, userId: uid, createdAt: new Date().toISOString() };
  const reviews = JSON.parse(localStorage.getItem("stm_reviews") || "[]");
  reviews.unshift(review);
  localStorage.setItem("stm_reviews", JSON.stringify(reviews));
  if (firebaseReady) {
    try {
      const { db } = await getFirebase();
      const { collection, addDoc } = await import("firebase/firestore");
      await addDoc(collection(db, "reviews"), review);
    } catch {}
  }
  return review;
}

export async function getReviews(targetId) {
  const reviews = JSON.parse(localStorage.getItem("stm_reviews") || "[]");
  return reviews.filter(r => r.targetId === targetId);
}

// ── DEMO FALLBACKS ────────────────────────────────────────────

function demoSignUp(name, email) {
  const user = {
    uid: `demo-${Date.now()}`, displayName: name, email,
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0E7FD5&color=fff`
  };
  localStorage.setItem("stm_demo_user", JSON.stringify(user));
  return user;
}

function demoSignIn(email) {
  const name = email.split("@")[0];
  const user = {
    uid: `demo-${Date.now()}`, displayName: name, email,
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0E7FD5&color=fff`
  };
  localStorage.setItem("stm_demo_user", JSON.stringify(user));
  return user;
}

function getDemoUser() {
  return {
    uid: "demo-001", name: "Demo Traveler", email: "demo@smarttravel.com",
    avatar: "https://ui-avatars.com/api/?name=Demo+Traveler&background=0E7FD5&color=fff",
    preferences: { currency: "USD" }, createdAt: "2025-01-01"
  };
}
