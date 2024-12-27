# Crosstime

Crosstime is an open-source meeting coordination tool that helps groups find the best time to meet across different timezones. Built with Next.js, TypeScript, and MongoDB. Crosstime is much more beautiful, responsive, and functional than When2Meet. Running on https://crosstime.org. 

## Features

- 📅 Create events with multiple dates and time slots
- 🌍 Automatic timezone conversion
- 👥 Anonymous participation
- 🔒 Optional response limits
- 📊 Visual availability heatmap
- 📱 Mobile-friendly interface
- 🗓️ Calendar import support (soon)
- 🔐 Password protection for limited events

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Date/Time**: Luxon, date-fns
- **Authentication**: JWT
- **State Management**: React Hooks

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB database
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/crosstime.git
cd crosstime
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```bash
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `MONGODB_DB` | Database name | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL of your application | Yes |

## API Routes

### Events

- `POST /api/events` - Create a new event
- `GET /api/events` - Get event details
- `POST /api/events/users` - Add/update user availability
- `GET /api/events/users` - Get user session

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use ESLint for code linting
- Write meaningful commit messages
- Update documentation as needed

## Security Considerations

- Keep dependencies updated
- Use environment variables for sensitive data
- Implement rate limiting for production
- Hash passwords before storing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [Luxon](https://moment.github.io/luxon/) for timezone handling
- [Next.js](https://nextjs.org/) for the framework
- [MongoDB](https://www.mongodb.com/) for the database

## Support

For support, please open an issue in the GitHub repository or contact Ajay.  

Made by [Ajay Misra](https://ajaymisra.com). 
# crosstime
