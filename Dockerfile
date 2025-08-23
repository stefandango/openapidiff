FROM httpd:alpine

# Copy all static files to the Apache document root
COPY . /usr/local/apache2/htdocs/

# Ensure proper permissions
RUN chown -R www-data:www-data /usr/local/apache2/htdocs/