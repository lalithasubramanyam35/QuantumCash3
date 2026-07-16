sed -i '/import fs from '\''fs'\'';/d' server.js
sed -i '/import { GoogleGenAI } from '\''@google\/genai'\'';/d' server.js
sed -i '1i import fs from "fs";' server.js
sed -i '1i import { GoogleGenAI } from "@google/genai";' server.js
