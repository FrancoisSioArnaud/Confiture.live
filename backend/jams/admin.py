from django.contrib import admin
from .models import Jam, JamClientSession, JamEvent, JamSnapshot, JamTransaction

admin.site.register([Jam, JamTransaction, JamEvent, JamSnapshot, JamClientSession])
