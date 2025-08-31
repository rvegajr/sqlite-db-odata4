# Contributing to SQLite OData v4

Thank you for your interest in contributing to our OData v4 implementation for SQLite! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**: `git clone https://github.com/your-username/sqlite-db-odata4.git`
3. **Install dependencies**: `npm install`
4. **Run tests**: `npm test`
5. **Make your changes**
6. **Test your changes**: `npm test`
7. **Submit a pull request**

## 📋 Development Guidelines

### Code Style
- Use TypeScript with strict mode enabled
- Follow TDD (Test-Driven Development) principles
- Adhere to ISP (Interface Segregation Principle)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Testing
- Write tests for all new features
- Ensure 100% test coverage for critical paths
- Use descriptive test names
- Follow the existing test patterns

### Commit Messages
Use conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Process
1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit a pull request with a clear description

## 🏗️ Project Structure

```
packages/
├── odata-sqlite-contracts/    # Core interfaces and types
├── odata-sqlite-core/         # Main OData implementation
├── odata-sqlite-expand/       # $expand operations
├── odata-sqlite-search/       # Full-text search
├── odata-sqlite-aggregation/  # $apply aggregations
├── odata-sqlite-compute/      # $compute operations
├── odata-sqlite-batch/        # Batch operations
├── odata-sqlite-delta/        # Delta links
├── odata-sqlite-express/      # Express.js integration
└── odata-sqlite-astro/        # Astro integration
```

## 🐛 Reporting Issues

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)
- Code examples if applicable

## 📚 Documentation

- Keep README files up to date
- Add JSDoc comments for new APIs
- Update examples when adding features
- Document breaking changes

## 🎯 Areas for Contribution

- Performance optimizations
- Additional OData v4 features
- Framework integrations
- Documentation improvements
- Test coverage enhancements
- Bug fixes

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
