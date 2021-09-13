FROM alpine:latest

CMD ["crond", "-f"]

RUN echo -e "* * * * * cd /retropilot-server/; node -r esm worker.js\n* * * * * cd /retropilot-server; node -r esm server.js" > /etc/crontabs/root 

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

# Install dependencies
RUN apk add --no-cache git nodejs npm
# TODO maybe install nodejs-npm?

# Install Retropilot
RUN git clone "https://github.com/florianbrede-ayet/retropilot-server.git"; cd retropilot-server; npm install

# Install node packages, even though we should have it through retropilot...
RUN npm install -g esm

# Remove build dependencies
RUN apk del git

