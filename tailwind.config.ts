
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'sm': '640px',
				'md': '768px',
				'lg': '1024px',
				'xl': '1280px',
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				// Strong Green Theme
				border: '#BEE9C3',
				input: '#BEE9C3',
				ring: '#118C4F',
				background: '#ECFFF4', // light green
				foreground: '#134F31', // deep green
				primary: {
					DEFAULT: '#16A34A', // Vibrant green
					foreground: '#ECFFF4'
				},
				secondary: {
					DEFAULT: '#54C598', // Mint green
					foreground: '#134F31'
				},
				destructive: {
					DEFAULT: '#D64545',
					foreground: '#F3FDF7'
				},
				muted: {
					DEFAULT: '#DFF3E8',
					foreground: '#20A068'
				},
				accent: {
					DEFAULT: '#A3E6B1',
					foreground: '#1C5636'
				},
				popover: {
					DEFAULT: '#DFF3E8',
					foreground: '#134F31'
				},
				card: {
					DEFAULT: '#F3FDF7',
					foreground: '#134F31'
				},
				sidebar: {
					DEFAULT: "#ECFFF4",
					foreground: "#134F31",
					primary: "#16A34A",
					'primary-foreground': "#ECFFF4",
					accent: "#A3E6B1",
					'accent-foreground': "#134F31",
					border: "#BEE9C3",
					ring: "#118C4F"
				},
				green: {
					100: "#E5FFF1",
					400: "#63D993",
					600: "#20A068",
					700: "#118C4F",
					800: "#046D38",
				},
				cream: '#ECFFF4',
				earth: '#A3E6B1',
			},
			borderRadius: {
				lg: '0.75rem',
				md: '0.5rem',
				sm: '0.25rem'
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				serif: ['Merriweather', 'serif'],
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" }
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" }
				},
				"fade-in": {
					"0%": { opacity: "0", transform: "translateY(10px)" },
					"100%": { opacity: "1", transform: "translateY(0)" }
				},
				"slide-in": {
					"0%": { opacity: "0", transform: "translateX(-20px)" },
					"100%": { opacity: "1", transform: "translateX(0)" }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.5s ease-out',
				'slide-in': 'slide-in 0.5s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
