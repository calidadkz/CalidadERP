
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDhrdZ1aJ1xcgYdHSNEE1FkrTIYM8LRkrI",
  authDomain: "calidad-erp.firebaseapp.com",
  projectId: "calidad-erp",
  storageBucket: "calidad-erp.firebasestorage.app",
  messagingSenderId: "43671301159",
  appId: "1:43671301159:web:71b83509b45990a3ca7202",
  measurementId: "G-FEEW490F1R"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
