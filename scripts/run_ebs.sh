#!/usr/bin/env bash
git pull
sudo docker compose up -d --build
sudo docker compose logs -f -t --since 1m
