#!/usr/bin/env python3
"""
Test script that can be run from project root
"""
import sys
from pathlib import Path

# Ensure we're in the project root
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from backend.test_eog_connection import test_eog_api

if __name__ == "__main__":
    test_eog_api()

