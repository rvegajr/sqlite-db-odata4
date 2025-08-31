# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **DO NOT** create a public GitHub issue
Security vulnerabilities should be reported privately to prevent potential exploitation.

### 2. Email us directly
Send an email to [your-email@example.com] with the following information:

- **Subject**: `[SECURITY] Vulnerability in sqlite-db-odata4`
- **Description**: Clear description of the vulnerability
- **Steps to reproduce**: Detailed steps to reproduce the issue
- **Impact**: Potential impact of the vulnerability
- **Suggested fix**: If you have a suggested solution

### 3. What happens next
- We will acknowledge receipt within 48 hours
- We will investigate and provide updates
- We will work on a fix and coordinate disclosure
- Once fixed, we will release a patch and credit you (if desired)

## Security Best Practices

When using this library:

1. **Keep dependencies updated**: Regularly update to the latest versions
2. **Validate inputs**: Always validate and sanitize user inputs
3. **Use HTTPS**: Always use HTTPS in production
4. **Database security**: Follow SQLite security best practices
5. **Access control**: Implement proper authentication and authorization

## Security Features

This library includes several security features:

- **Input validation**: All OData queries are validated
- **SQL injection protection**: Parameterized queries prevent SQL injection
- **Type safety**: TypeScript strict mode prevents type-related vulnerabilities
- **Error handling**: Secure error messages that don't leak sensitive information

## Responsible Disclosure

We follow responsible disclosure practices:

- We will not publicly disclose vulnerabilities until a fix is available
- We will credit security researchers who responsibly report issues
- We will provide reasonable time for users to update before public disclosure

Thank you for helping keep our community secure! 🔒
