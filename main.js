// main.js
import './app.js'; // 既存 app.js は import 副作用で初期化される想定

// 必要に応じて DOMContentLoaded で明示初期化する場合：
// import { init } from './app.js';
// window.addEventListener('DOMContentLoaded', init);

