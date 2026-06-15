from django.contrib import admin
from .models import Jam, JamClientSession, JamEvent, JamSnapshot, JamTransaction


admin.site.register(Jam)
admin.site.register(JamTransaction)
admin.site.register(JamEvent)
admin.site.register(JamSnapshot)
admin.site.register(JamClientSession)
