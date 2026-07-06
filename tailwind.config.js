/** @type {import('tailwindcss').Config} */

export default {

  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],

  theme: {

    extend: {

      colors: {

        background:"#0b0f19",
        sidebar:"#111827",
        card:"#1e293b",
        primary:"#3b82f6",
        success:"#22c55e",
        danger:"#ef4444"

      }

    }

  },

  plugins:[]
}
