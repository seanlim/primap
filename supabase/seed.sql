SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict W57sVq0Pu2NcXbnIJ4JcoazWnIax21UVUc0VAIfSNFhpQyLP0aqOYo7dvVyCxeP

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") VALUES
	('564ba830-8225-4049-9f65-cf1378697d1c', NULL, '3b374b0c-adeb-48dc-bef3-51dfe2aef9b3', 's256', 'PJfoN2ylo6v1R8sUTVNg7shwZFe--rBMN-tVXEJVTgU', 'google', '', '', '2026-02-24 16:21:45.070176+00', '2026-02-24 16:21:45.070176+00', 'oauth', NULL, NULL, 'http://localhost:3000/auth/callback', NULL, NULL, false),
	('265c66e8-cbcd-4fed-9e99-c27ea1f83782', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '8f169151-c48a-4274-8831-8c324efef769', 's256', 'k3Hxs0F9yZxrmnmF1NyZrrHSFOR8caZGSdqGxijkW2k', 'email', '', '', '2026-02-24 16:42:18.841057+00', '2026-02-24 16:42:36.202004+00', 'email/signup', '2026-02-24 16:42:36.201943+00', NULL, NULL, NULL, NULL, false),
	('a954b3d3-7bf6-48e2-9bac-931c9a66393f', NULL, 'cb004c95-1f24-4be6-8c5f-78dbd155788d', 'plain', '6470fc9ec79a062975a14a1ea54beb8d246987a7e96ed36f9e1652468b9a7aaedf42ab6627769b26364d64f796c723241ee28630c97c04e3', 'google', '', '', '2026-04-08 13:59:56.3019+00', '2026-04-08 13:59:56.3019+00', 'oauth', NULL, NULL, 'http://localhost:3000', NULL, NULL, false),
	('4b8489a6-549d-49fb-b394-21990668c698', NULL, '8d3baa78-c53a-4c3c-b581-cc0f4d7bc59b', 's256', 'cvUbuBxJ9srAFqaXZb5ZwDoIJ1Ibw77RijCHmM576Wo', 'google', '', '', '2026-02-27 15:33:17.850815+00', '2026-02-27 15:33:17.850815+00', 'oauth', NULL, NULL, 'http://localhost:3000/auth/callback', NULL, NULL, false),
	('d6c8135f-1733-4752-9644-a44bf4ce4fb8', '6d9947e9-cec3-44a9-89e9-6a6a1a516a5e', '73408dac-bd45-4329-b79f-db1a7704c5f0', 's256', '7I2AxSSinoU3T9KbriFupg93dt3K5h0CevzlDR2WRS0', 'email', '', '', '2026-03-10 17:46:38.170063+00', '2026-03-10 17:46:57.154824+00', 'email/signup', '2026-03-10 17:46:57.154768+00', NULL, NULL, NULL, NULL, false),
	('82907721-d1e9-4c6d-9005-ee7e3953bb40', 'e3053f0d-e6fc-42b4-a252-4bbc14fcee58', '16e3a956-8afb-464b-a33a-04e666937fb0', 's256', 'BpYXgg75INzUtRf3V0yCWjY8HMPzuQh59NYnvKq0YQA', 'email', '', '', '2026-03-07 09:56:53.444057+00', '2026-03-07 09:56:53.444057+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('846d54df-35e8-43c6-ab52-18b4ae2cefcd', '2c1dad59-dfae-48bb-bf20-d5a93e29a0e3', '86f9c4af-1c16-4cd3-b452-253eae749c80', 's256', 'DLWQ9asMlNsjw60k0-CvzXTwB4tEBxu6UXBwF8kXAKM', 'email', '', '', '2026-03-07 10:04:02.237022+00', '2026-03-07 10:04:02.237022+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('a4cda6be-1b0b-4c96-a1aa-179f4a1587cd', 'f59afa07-f3d9-41e1-93db-d3fefa39559a', 'b33e964c-1769-4125-a8bb-abb5d75b4d5d', 's256', 'DdrqKV8tOLHNJGzo41pM0K5-rWBnjoWj8kZTbPA1jcw', 'email', '', '', '2026-03-09 16:12:15.268734+00', '2026-03-09 16:12:24.611159+00', 'email/signup', '2026-03-09 16:12:24.61111+00', NULL, NULL, NULL, NULL, false),
	('2b3e6053-f3f8-49e9-ad88-92e609e88723', NULL, '99dc5bb2-c58e-48db-aefc-d74d2aab74aa', 's256', 'hqlX-blinBy_XhUm-t7npT4B1bTaGmtIcG8TuPHTIm0', 'google', '', '', '2026-03-26 14:35:53.565947+00', '2026-03-26 14:35:53.565947+00', 'oauth', NULL, NULL, 'http://localhost:3000/auth/callback', NULL, NULL, false),
	('f74d48a7-5b2d-490a-9591-8bf86c00097e', '0d773129-0dab-4799-b46c-c5e042b50739', '505a35c4-62bd-4f7e-a683-e858568c28b1', 's256', 'UyEMyU59oSqA1MqfzlVi79hvU1a4vdy-fQg5Cc2fiX4', 'email', '', '', '2026-04-13 07:02:24.667329+00', '2026-04-13 07:02:24.667329+00', 'email/signup', NULL, NULL, NULL, NULL, NULL, false),
	('52b45fdb-0011-40ce-a41e-0a85c0446df7', NULL, '1c7beb4e-a549-4777-815d-9f4f867ba92f', 's256', 'UnRuxT0s3CshjbOBI8OGVAdsLxqYnWemosJuoLmxllI', 'google', '', '', '2026-05-20 17:43:25.467203+00', '2026-05-20 17:43:25.467203+00', 'oauth', NULL, NULL, 'http://localhost:3000/auth/callback', NULL, NULL, false),
	('d39fb0e7-6e9d-43f0-916a-eb66a3f8b176', NULL, '195604e5-0595-4b77-8920-0e471a4b2792', 's256', '5Lref64I1G-YeqTBg31Ndjn2OG_po6HQM_rVRXBKC0U', 'google', '', '', '2026-05-28 05:36:45.613654+00', '2026-05-28 05:36:45.613654+00', 'oauth', NULL, NULL, 'http://localhost:3000/auth/callback', NULL, NULL, false);


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '56823340-0cb5-4679-aab3-8fa552178a90', 'authenticated', 'authenticated', 'charlie@primap.demo', '$2a$10$J1wSnneu6hNkPyJ8Ssa1teEwtmSQr7ZLmh.1Aghu83Q0/NMfNhhXW', '2026-04-11 16:06:11.145348+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-11 16:46:38.150476+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-11 16:06:11.142049+00', '2026-04-11 16:46:38.158888+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'authenticated', 'authenticated', 'alice@primap.demo', '$2a$10$/GE7P3rQ.QxYIMNZ4XmC1..Xf8V4KMjuA82q6wRrgvQ92l6tLC7ce', '2026-04-11 16:05:38.102013+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-06-28 06:46:28.50196+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-11 16:05:38.09452+00', '2026-06-28 06:46:28.53829+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'authenticated', 'authenticated', 'bob@primap.demo', '$2a$10$OtST8/UxtnU14U7iwK2.UOd6VjgCH4.qrqOV//vYb8gmj.bCCBSSG', '2026-04-11 16:05:51.5391+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-06-28 06:47:12.137111+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-11 16:05:51.5346+00', '2026-06-28 06:47:12.13947+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', 'authenticated', 'authenticated', 'seanlimdev856@gmail.com', '$2a$10$vnbj57RcdI7x.Qml.T/piu4cQ/74MHkB4nAV0TSqNNN.rfpTWJVZ.', '2026-02-24 16:42:36.130237+00', NULL, '', '2026-02-24 16:42:18.850552+00', '', NULL, '', '', NULL, '2026-05-07 05:12:50.876144+00', '{"provider": "email", "providers": ["email", "google"]}', '{"iss": "https://accounts.google.com", "sub": "112840070263508822078", "name": "Sean Lim", "email": "seanlimdev856@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKmo0oM3VEgaLI05tJ___kM5mEx4pGiVAWhzLzxuZDUrpszTDFO=s96-c", "full_name": "Sean Lim", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKmo0oM3VEgaLI05tJ___kM5mEx4pGiVAWhzLzxuZDUrpszTDFO=s96-c", "provider_id": "112840070263508822078", "email_verified": true, "phone_verified": false}', NULL, '2026-02-24 16:42:18.794597+00', '2026-05-11 08:21:58.808815+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '51b1cf99-e8c3-4c9a-8143-6be06b6dba70', 'authenticated', 'authenticated', 'bobtest972@gmail.com', '$2a$10$ti8bSKuM1kCCMiXhGQPY5uZNrbZnuOgj9zTKHrmzQXPE/mGXm8q62', '2026-05-11 06:47:54.218799+00', NULL, '', '2026-05-11 06:47:42.044193+00', '', NULL, '', '', NULL, '2026-05-11 07:17:24.257684+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "51b1cf99-e8c3-4c9a-8143-6be06b6dba70", "email": "bobtest972@gmail.com", "email_verified": true, "phone_verified": false}', NULL, '2026-05-11 06:47:42.008323+00', '2026-07-02 13:56:47.571021+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', 'authenticated', 'authenticated', 'kjaehyeok21@gmail.com', '$2a$10$0Ma1l2Fz2SrrwtXLw16nUOIuPXusKDQg7.iBvs.51xpkjFIrjZ43O', '2026-02-21 11:01:48.973751+00', NULL, '', '2026-02-21 11:01:38.912778+00', '', '2026-07-05 14:47:38.24498+00', '', '', NULL, '2026-07-05 14:47:38.419599+00', '{"provider": "email", "providers": ["email", "google", "phone"]}', '{"iss": "https://accounts.google.com", "sub": "106309444379726868994", "name": "Jae Hyeok Kim", "email": "kjaehyeok21@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocL9PYGprmymmNZB6E4JSJ5ZUHLDhG7sIS8INlMRCTT2DhHN1A=s96-c", "full_name": "Jae Hyeok Kim", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocL9PYGprmymmNZB6E4JSJ5ZUHLDhG7sIS8INlMRCTT2DhHN1A=s96-c", "provider_id": "106309444379726868994", "email_verified": true, "phone_verified": false}', NULL, '2026-02-21 11:01:38.86023+00', '2026-07-05 14:47:38.448923+00', NULL, NULL, '6588197184', '42a3a294d23b3ce744d5777f9bc45f2ff5b9262f072310745960874d', '2026-07-05 14:40:29.489256+00', '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'a4645a31-3068-463d-938d-3b02b583d5f1', 'authenticated', 'authenticated', 'kjaehyeok020125@gmail.com', '$2a$10$GFvkNohMkM8Ipi8JLXSqcuzdtqYPeQGyqBYOU2WkjUEtMg3XuACMe', '2026-07-05 14:26:25.732337+00', NULL, '', '2026-07-05 14:25:40.609055+00', '', NULL, '', '', NULL, '2026-07-05 14:26:25.909556+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "a4645a31-3068-463d-938d-3b02b583d5f1", "email": "kjaehyeok020125@gmail.com", "full_name": "Jay Kim", "birth_month": "2012-01-01", "phone_number": "+6588197184", "email_verified": true, "phone_verified": false}', NULL, '2026-07-05 14:25:40.511583+00', '2026-07-05 17:21:26.565887+00', NULL, NULL, '6588197184', '42a3a294d23b3ce744d5777f9bc45f2ff5b9262f072310745960874d', '2026-07-05 14:42:35.556551+00', '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'f59afa07-f3d9-41e1-93db-d3fefa39559a', 'authenticated', 'authenticated', 'e0893439@u.nus.edu', '$2a$10$YPMYWEivdWM32cm4HmXyUOAWmcF84lSfPAVsO2yWpoeItdrs.Ub9.', '2026-03-09 16:12:24.601643+00', NULL, '', '2026-03-09 16:12:15.282883+00', '', NULL, '', '', NULL, '2026-03-13 14:57:40.446539+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "f59afa07-f3d9-41e1-93db-d3fefa39559a", "email": "e0893439@u.nus.edu", "email_verified": true, "phone_verified": false}', NULL, '2026-03-09 16:12:14.954884+00', '2026-03-13 14:57:40.483617+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '0248644a-1206-4888-8289-7a0df5789d2c', 'authenticated', 'authenticated', 'juneha1120@gmail.com', '$2a$10$t9vM6XZseEJgo7PNe8KcJOf2wz.p45pZo6tdTzMTcE0jeL624x8B.', '2026-02-27 15:38:47.072836+00', NULL, '', '2026-02-27 15:38:37.259547+00', '', NULL, '', '', NULL, '2026-04-11 19:26:34.908568+00', '{"provider": "email", "providers": ["email", "google"]}', '{"iss": "https://accounts.google.com", "sub": "114927057190229875505", "name": "Jiwoon Ha", "email": "juneha1120@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocLkL8-a1i7wuugUwn4emhoPIIzQEC8_sIseMOCHDVA6kC7Y8MBh=s96-c", "full_name": "Jiwoon Ha", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLkL8-a1i7wuugUwn4emhoPIIzQEC8_sIseMOCHDVA6kC7Y8MBh=s96-c", "provider_id": "114927057190229875505", "email_verified": true, "phone_verified": false}', NULL, '2026-02-27 15:38:37.252725+00', '2026-04-11 19:26:34.923807+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '4406c55b-09b6-4f82-8975-6bffe8886513', 'authenticated', 'authenticated', 'ngkhengyang@gmail.com', NULL, '2026-05-20 18:29:54.225762+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-15 11:13:49.510694+00', '{"provider": "google", "providers": ["google", "phone"]}', '{"iss": "https://accounts.google.com", "sub": "116166737032137874458", "name": "Ng Kheng Yang", "email": "ngkhengyang@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKKe1Z0kiGHvBsue_CFIa40iox7RhqweB172zDbEAnfx7DuzhbQ=s96-c", "full_name": "Ng Kheng Yang", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKKe1Z0kiGHvBsue_CFIa40iox7RhqweB172zDbEAnfx7DuzhbQ=s96-c", "provider_id": "116166737032137874458", "email_verified": true, "phone_verified": false}', NULL, '2026-05-20 18:29:54.127625+00', '2026-07-15 12:17:00.945986+00', '6597868371', '2026-07-07 08:39:57.196593+00', '', '', '2026-07-07 08:37:25.460261+00', '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'authenticated', 'authenticated', 'admin@primap.demo', '$2a$10$P5ZSImFVT0RTT4yMb0gm9.GNllvsvfiwWG7e7O4G35AZTeikFaGC.', '2026-04-11 16:05:09.942587+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-16 10:52:44.652466+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-11 16:05:09.889186+00', '2026-07-16 10:52:44.743202+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'ef71f1fa-d448-4c9f-9b10-76a559bb8069', 'authenticated', 'authenticated', 'dan@primap.demo', '$2a$10$Hop.DCdnIbRFic4lw9RZjedMPXZbyh6Od7GArC3vj2p/fedsFBSYe', '2026-04-11 16:06:29.497076+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-11 16:51:33.617079+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-11 16:06:29.493771+00', '2026-04-11 16:51:33.669373+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'fe1570e8-c7e9-47ad-b4cc-41cfcd6105f8', 'authenticated', 'authenticated', 'emily@primap.demo', '$2a$10$ru7YLnCpiFbBXjo7jLqj3e5HWfRyxqFxbhXT6Fmd3nDPF49IwExVq', '2026-04-12 14:15:19.921238+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-06-28 06:50:17.287131+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-12 14:15:19.881486+00', '2026-06-28 06:50:17.292366+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'c42a5bc3-7895-4485-8692-d1b235da6b49', 'authenticated', 'authenticated', 'fred@primap.demo', '$2a$10$MGiqUTjrVSJZ1wa5qPQFYO1tJzLkgePY9bT/knTcwMQRlqrmGYLYa', '2026-04-12 14:15:36.430566+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-04-12 14:16:06.430487+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-04-12 14:15:36.426014+00', '2026-04-12 14:16:06.439724+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'authenticated', 'authenticated', 'macdonaldbenny1@gmail.com', NULL, '2026-05-28 05:34:19.916426+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-06-24 09:40:54.989632+00', '{"provider": "google", "providers": ["google"]}', '{"iss": "https://accounts.google.com", "sub": "113016191105028621991", "name": "Sneaky Owl", "email": "macdonaldbenny1@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ0qfa9rchSfl5KqVf2JeWc7FxYSef4IZTMOdCHwEVBAHvXRLso=s96-c", "full_name": "Sneaky Owl", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ0qfa9rchSfl5KqVf2JeWc7FxYSef4IZTMOdCHwEVBAHvXRLso=s96-c", "provider_id": "113016191105028621991", "email_verified": true, "phone_verified": false}', NULL, '2026-05-28 05:34:19.827277+00', '2026-06-24 10:45:05.380643+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'authenticated', 'authenticated', 'trcosine@gmail.com', NULL, '2026-07-07 14:10:35.85524+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-15 12:16:47.484716+00', '{"provider": "google", "providers": ["google", "phone"]}', '{"iss": "https://accounts.google.com", "sub": "118149121366222643577", "name": "awdse22", "email": "trcosine@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocK89Me0hgvvCSSHLq1NYF5wFml-eNivp8n0lEUAJq-O1SkfS20=s96-c", "full_name": "awdse22", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocK89Me0hgvvCSSHLq1NYF5wFml-eNivp8n0lEUAJq-O1SkfS20=s96-c", "provider_id": "118149121366222643577", "email_verified": true, "phone_verified": false}', NULL, '2026-07-07 14:10:35.806228+00', '2026-07-16 10:52:58.855106+00', '6599887766', '2026-07-07 14:31:04.414119+00', '', '', '2026-07-07 14:30:54.682824+00', '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{"sub": "0f2cbdab-dfca-42c9-9a90-1b4b677a84ce", "email": "kjaehyeok21@gmail.com", "email_verified": true, "phone_verified": false}', 'email', '2026-02-21 11:01:38.900013+00', '2026-02-21 11:01:38.900086+00', '2026-02-21 11:01:38.900086+00', 'c4249edc-35ac-4e90-9d3e-da2f42d27aa2'),
	('ec26112d-5f65-4666-9d40-5fb222f55dbf', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '{"sub": "ec26112d-5f65-4666-9d40-5fb222f55dbf", "email": "seanlimdev856@gmail.com", "email_verified": true, "phone_verified": false}', 'email', '2026-02-24 16:42:18.833326+00', '2026-02-24 16:42:18.833375+00', '2026-02-24 16:42:18.833375+00', 'f1bbdfd6-ddc0-40fb-ae80-d3b4c43f01ac'),
	('fe1570e8-c7e9-47ad-b4cc-41cfcd6105f8', 'fe1570e8-c7e9-47ad-b4cc-41cfcd6105f8', '{"sub": "fe1570e8-c7e9-47ad-b4cc-41cfcd6105f8", "email": "emily@primap.demo", "email_verified": false, "phone_verified": false}', 'email', '2026-04-12 14:15:19.91367+00', '2026-04-12 14:15:19.913727+00', '2026-04-12 14:15:19.913727+00', 'f35756a4-8bc2-482b-a7e0-3aed4d381b17'),
	('0248644a-1206-4888-8289-7a0df5789d2c', '0248644a-1206-4888-8289-7a0df5789d2c', '{"sub": "0248644a-1206-4888-8289-7a0df5789d2c", "email": "juneha1120@gmail.com", "email_verified": true, "phone_verified": false}', 'email', '2026-02-27 15:38:37.256772+00', '2026-02-27 15:38:37.256815+00', '2026-02-27 15:38:37.256815+00', 'ef2bfd8e-5be8-41e9-a607-04ba794b09c0'),
	('114927057190229875505', '0248644a-1206-4888-8289-7a0df5789d2c', '{"iss": "https://accounts.google.com", "sub": "114927057190229875505", "name": "Jiwoon Ha", "email": "juneha1120@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocLkL8-a1i7wuugUwn4emhoPIIzQEC8_sIseMOCHDVA6kC7Y8MBh=s96-c", "full_name": "Jiwoon Ha", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocLkL8-a1i7wuugUwn4emhoPIIzQEC8_sIseMOCHDVA6kC7Y8MBh=s96-c", "provider_id": "114927057190229875505", "email_verified": true, "phone_verified": false}', 'google', '2026-03-06 15:00:39.297326+00', '2026-03-06 15:00:39.29738+00', '2026-04-11 19:26:34.598336+00', '541350bf-9f8f-47ca-8657-64d943347380'),
	('f59afa07-f3d9-41e1-93db-d3fefa39559a', 'f59afa07-f3d9-41e1-93db-d3fefa39559a', '{"sub": "f59afa07-f3d9-41e1-93db-d3fefa39559a", "email": "e0893439@u.nus.edu", "email_verified": true, "phone_verified": false}', 'email', '2026-03-09 16:12:15.012525+00', '2026-03-09 16:12:15.012578+00', '2026-03-09 16:12:15.012578+00', '6d66389a-4241-4c2e-9946-a0427510244f'),
	('c42a5bc3-7895-4485-8692-d1b235da6b49', 'c42a5bc3-7895-4485-8692-d1b235da6b49', '{"sub": "c42a5bc3-7895-4485-8692-d1b235da6b49", "email": "fred@primap.demo", "email_verified": false, "phone_verified": false}', 'email', '2026-04-12 14:15:36.428696+00', '2026-04-12 14:15:36.428747+00', '2026-04-12 14:15:36.428747+00', 'ca0ff8cd-296a-4945-9566-5de99a18536a'),
	('71c422c5-ff93-495c-9f90-b8cf3e40d696', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '{"sub": "71c422c5-ff93-495c-9f90-b8cf3e40d696", "email": "admin@primap.demo", "email_verified": false, "phone_verified": false}', 'email', '2026-04-11 16:05:09.93565+00', '2026-04-11 16:05:09.935707+00', '2026-04-11 16:05:09.935707+00', '923bdfa8-5108-4a2a-ab70-0d8b8b9fc87a'),
	('888758d2-5bf0-4ecb-a85e-cc998ebe775b', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '{"sub": "888758d2-5bf0-4ecb-a85e-cc998ebe775b", "email": "alice@primap.demo", "email_verified": false, "phone_verified": false}', 'email', '2026-04-11 16:05:38.097295+00', '2026-04-11 16:05:38.097342+00', '2026-04-11 16:05:38.097342+00', 'bc1da92e-21bb-42e4-9257-18711c0191ff'),
	('cc60e20c-0986-4157-a153-1c62e0c76042', 'cc60e20c-0986-4157-a153-1c62e0c76042', '{"sub": "cc60e20c-0986-4157-a153-1c62e0c76042", "email": "bob@primap.demo", "email_verified": false, "phone_verified": false}', 'email', '2026-04-11 16:05:51.537112+00', '2026-04-11 16:05:51.537163+00', '2026-04-11 16:05:51.537163+00', '977f3289-a36e-42b2-8556-397ac9cf7ea2'),
	('56823340-0cb5-4679-aab3-8fa552178a90', '56823340-0cb5-4679-aab3-8fa552178a90', '{"sub": "56823340-0cb5-4679-aab3-8fa552178a90", "email": "charlie@primap.demo", "email_verified": false, "phone_verified": false}', 'email', '2026-04-11 16:06:11.144044+00', '2026-04-11 16:06:11.144093+00', '2026-04-11 16:06:11.144093+00', '74be1902-cd58-4b8b-92a0-0dbe3a3a125a'),
	('ef71f1fa-d448-4c9f-9b10-76a559bb8069', 'ef71f1fa-d448-4c9f-9b10-76a559bb8069', '{"sub": "ef71f1fa-d448-4c9f-9b10-76a559bb8069", "email": "dan@primap.demo", "email_verified": false, "phone_verified": false}', 'email', '2026-04-11 16:06:29.495726+00', '2026-04-11 16:06:29.495771+00', '2026-04-11 16:06:29.495771+00', 'aa79ec12-76e5-405d-8dee-d2a0b106cc4f'),
	('0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{"sub": "0f2cbdab-dfca-42c9-9a90-1b4b677a84ce", "phone": "6588197184", "email_verified": false, "phone_verified": true}', 'phone', '2026-06-13 14:29:38.231304+00', '2026-06-13 14:29:38.231984+00', '2026-06-13 14:29:38.231984+00', '325a2ed4-05f4-499f-a681-1ecfdd9efa7f'),
	('112840070263508822078', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '{"iss": "https://accounts.google.com", "sub": "112840070263508822078", "name": "Sean Lim", "email": "seanlimdev856@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKmo0oM3VEgaLI05tJ___kM5mEx4pGiVAWhzLzxuZDUrpszTDFO=s96-c", "full_name": "Sean Lim", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKmo0oM3VEgaLI05tJ___kM5mEx4pGiVAWhzLzxuZDUrpszTDFO=s96-c", "provider_id": "112840070263508822078", "email_verified": true, "phone_verified": false}', 'google', '2026-03-10 17:45:25.613246+00', '2026-03-10 17:45:25.613306+00', '2026-05-07 05:12:50.265682+00', 'ca4b5a0f-b102-4d33-8f8b-4243941410d4'),
	('51b1cf99-e8c3-4c9a-8143-6be06b6dba70', '51b1cf99-e8c3-4c9a-8143-6be06b6dba70', '{"sub": "51b1cf99-e8c3-4c9a-8143-6be06b6dba70", "email": "bobtest972@gmail.com", "email_verified": true, "phone_verified": false}', 'email', '2026-05-11 06:47:42.028351+00', '2026-05-11 06:47:42.028929+00', '2026-05-11 06:47:42.028929+00', '92b825ec-48f2-4ec9-a436-096ab15dad17'),
	('106309444379726868994', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{"iss": "https://accounts.google.com", "sub": "106309444379726868994", "name": "Jae Hyeok Kim", "email": "kjaehyeok21@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocL9PYGprmymmNZB6E4JSJ5ZUHLDhG7sIS8INlMRCTT2DhHN1A=s96-c", "full_name": "Jae Hyeok Kim", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocL9PYGprmymmNZB6E4JSJ5ZUHLDhG7sIS8INlMRCTT2DhHN1A=s96-c", "provider_id": "106309444379726868994", "email_verified": true, "phone_verified": false}', 'google', '2026-06-13 03:33:00.424291+00', '2026-06-13 03:33:00.424773+00', '2026-07-05 13:18:55.207291+00', 'e69a33a2-7cf5-4bf3-a4d7-6a866d2c393c'),
	('113016191105028621991', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', '{"iss": "https://accounts.google.com", "sub": "113016191105028621991", "name": "Sneaky Owl", "email": "macdonaldbenny1@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ0qfa9rchSfl5KqVf2JeWc7FxYSef4IZTMOdCHwEVBAHvXRLso=s96-c", "full_name": "Sneaky Owl", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ0qfa9rchSfl5KqVf2JeWc7FxYSef4IZTMOdCHwEVBAHvXRLso=s96-c", "provider_id": "113016191105028621991", "email_verified": true, "phone_verified": false}', 'google', '2026-05-28 05:34:19.902792+00', '2026-05-28 05:34:19.903837+00', '2026-06-24 09:40:54.663999+00', 'f1317685-da7b-4dee-b5d4-f0732f92410a'),
	('a4645a31-3068-463d-938d-3b02b583d5f1', 'a4645a31-3068-463d-938d-3b02b583d5f1', '{"sub": "a4645a31-3068-463d-938d-3b02b583d5f1", "email": "kjaehyeok020125@gmail.com", "full_name": "Jay Kim", "birth_month": "2012-01-01", "phone_number": "+6588197184", "email_verified": true, "phone_verified": false}', 'email', '2026-07-05 14:25:40.588177+00', '2026-07-05 14:25:40.58824+00', '2026-07-05 14:25:40.58824+00', '73c71616-2202-4a1d-8046-1e6906bf6097'),
	('4406c55b-09b6-4f82-8975-6bffe8886513', '4406c55b-09b6-4f82-8975-6bffe8886513', '{"sub": "4406c55b-09b6-4f82-8975-6bffe8886513", "phone": "6597868371", "email_verified": false, "phone_verified": true}', 'phone', '2026-07-07 08:39:57.191654+00', '2026-07-07 08:39:57.191717+00', '2026-07-07 08:39:57.208479+00', '2caecba5-2cb2-4aa4-91e1-5c0f16a81ee3'),
	('9a790d9b-71fc-4926-8135-4c8ddea1ec40', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', '{"sub": "9a790d9b-71fc-4926-8135-4c8ddea1ec40", "phone": "6599887766", "email_verified": false, "phone_verified": true}', 'phone', '2026-07-07 14:31:04.410156+00', '2026-07-07 14:31:04.410203+00', '2026-07-07 14:31:04.421967+00', '16d77d9e-2d25-4bf3-85c6-bad3e080763f'),
	('116166737032137874458', '4406c55b-09b6-4f82-8975-6bffe8886513', '{"iss": "https://accounts.google.com", "sub": "116166737032137874458", "name": "Ng Kheng Yang", "email": "ngkhengyang@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocKKe1Z0kiGHvBsue_CFIa40iox7RhqweB172zDbEAnfx7DuzhbQ=s96-c", "full_name": "Ng Kheng Yang", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocKKe1Z0kiGHvBsue_CFIa40iox7RhqweB172zDbEAnfx7DuzhbQ=s96-c", "provider_id": "116166737032137874458", "email_verified": true, "phone_verified": false}', 'google', '2026-05-20 18:29:54.21088+00', '2026-05-20 18:29:54.210937+00', '2026-07-15 11:13:49.134456+00', 'e927e794-d292-438f-b98b-2b5f86ab921e'),
	('118149121366222643577', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', '{"iss": "https://accounts.google.com", "sub": "118149121366222643577", "name": "awdse22", "email": "trcosine@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocK89Me0hgvvCSSHLq1NYF5wFml-eNivp8n0lEUAJq-O1SkfS20=s96-c", "full_name": "awdse22", "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocK89Me0hgvvCSSHLq1NYF5wFml-eNivp8n0lEUAJq-O1SkfS20=s96-c", "provider_id": "118149121366222643577", "email_verified": true, "phone_verified": false}', 'google', '2026-07-07 14:10:35.846928+00', '2026-07-07 14:10:35.846984+00', '2026-07-15 12:16:47.091329+00', '842c505b-80ae-46bb-b9cf-4c35d4a5969d');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('5bdb25a6-a307-40bf-baef-aa921c2e2816', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-07-05 14:40:29.254497+00', '2026-07-05 14:40:29.254497+00', NULL, 'aal1', NULL, NULL, 'node', '195.133.129.12', NULL, NULL, NULL, NULL, NULL),
	('29221ca7-18c2-4e28-9a0a-ce05b9f9eb43', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-07-05 14:47:38.421254+00', '2026-07-05 14:47:38.421254+00', NULL, 'aal1', NULL, NULL, 'node', '195.133.129.12', NULL, NULL, NULL, NULL, NULL),
	('63697f7b-ae27-4360-b0b8-853047a08ef2', '0248644a-1206-4888-8289-7a0df5789d2c', '2026-04-11 16:46:00.237779+00', '2026-04-11 16:46:00.237779+00', NULL, 'aal1', NULL, NULL, 'node', '218.111.77.32', NULL, NULL, NULL, NULL, NULL),
	('205f45b5-8e78-43e4-969b-3f1e18cce959', '0248644a-1206-4888-8289-7a0df5789d2c', '2026-04-11 17:06:15.770148+00', '2026-04-11 17:06:15.770148+00', NULL, 'aal1', NULL, NULL, 'node', '218.111.77.32', NULL, NULL, NULL, NULL, NULL),
	('da256921-50f5-4511-96bb-c4629173bda1', '0248644a-1206-4888-8289-7a0df5789d2c', '2026-04-11 19:26:34.908666+00', '2026-04-11 19:26:34.908666+00', NULL, 'aal1', NULL, NULL, 'node', '218.111.77.32', NULL, NULL, NULL, NULL, NULL),
	('3f9b4651-2368-4e8e-95aa-56001e5398dc', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '2026-07-16 10:52:44.653806+00', '2026-07-16 10:52:44.653806+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '119.74.65.158', NULL, NULL, NULL, NULL, NULL),
	('ae1782b7-f8ab-4557-914b-3a289983e104', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', '2026-07-15 12:16:47.484807+00', '2026-07-16 10:52:59.162174+00', NULL, 'aal1', NULL, '2026-07-16 10:52:59.162061', 'Next.js Middleware', '119.74.65.158', NULL, NULL, NULL, NULL, NULL),
	('31ee9808-6448-457d-a9b5-9ec252047009', 'a4645a31-3068-463d-938d-3b02b583d5f1', '2026-07-05 14:26:25.910684+00', '2026-07-05 17:21:26.590983+00', NULL, 'aal1', NULL, '2026-07-05 17:21:26.590867', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36', '195.133.129.12', NULL, NULL, NULL, NULL, NULL),
	('63d95be7-68cf-4fe9-a818-9467f44e490c', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '2026-05-07 05:12:50.879167+00', '2026-05-11 08:21:58.828738+00', NULL, 'aal1', NULL, '2026-05-11 08:21:58.828615', 'Next.js Middleware', '129.126.244.201', NULL, NULL, NULL, NULL, NULL),
	('be105e3a-5dc4-401a-a55a-a91e05afa0d3', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '2026-03-27 03:25:27.157564+00', '2026-04-13 02:56:34.97657+00', NULL, 'aal1', NULL, '2026-04-13 02:56:34.976463', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '129.126.207.37', NULL, NULL, NULL, NULL, NULL),
	('fbeab965-03ed-4250-960a-12030fcbc4bd', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '2026-03-27 03:19:15.17265+00', '2026-03-27 03:19:15.17265+00', NULL, 'aal1', NULL, NULL, 'node', '137.132.26.227', NULL, NULL, NULL, NULL, NULL),
	('22341295-1fa7-4529-a7a3-5d56fc2c5f65', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', '2026-06-24 09:40:54.991802+00', '2026-06-24 10:45:05.397651+00', NULL, 'aal1', NULL, '2026-06-24 10:45:05.397517', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0', '138.75.27.174', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('31ee9808-6448-457d-a9b5-9ec252047009', '2026-07-05 14:26:25.930104+00', '2026-07-05 14:26:25.930104+00', 'email/signup', '043bf726-f417-4d0e-819a-e2d149201c21'),
	('5bdb25a6-a307-40bf-baef-aa921c2e2816', '2026-07-05 14:40:29.277958+00', '2026-07-05 14:40:29.277958+00', 'otp', '06472fb2-0bc5-4852-a383-10bdd267928f'),
	('29221ca7-18c2-4e28-9a0a-ce05b9f9eb43', '2026-07-05 14:47:38.44943+00', '2026-07-05 14:47:38.44943+00', 'otp', '1d17ddc6-6a42-46f3-b4e5-e439f10f0743'),
	('63697f7b-ae27-4360-b0b8-853047a08ef2', '2026-04-11 16:46:00.266664+00', '2026-04-11 16:46:00.266664+00', 'oauth', '0b0cd211-46d5-4c1f-9bc2-c3bb062d3788'),
	('205f45b5-8e78-43e4-969b-3f1e18cce959', '2026-04-11 17:06:15.804212+00', '2026-04-11 17:06:15.804212+00', 'oauth', 'e24f0e2d-1971-4e5c-95f6-f05eff1c1a7b'),
	('da256921-50f5-4511-96bb-c4629173bda1', '2026-04-11 19:26:34.924194+00', '2026-04-11 19:26:34.924194+00', 'oauth', '555f4a02-c947-4395-a092-7eb12c3603db'),
	('ae1782b7-f8ab-4557-914b-3a289983e104', '2026-07-15 12:16:47.494069+00', '2026-07-15 12:16:47.494069+00', 'oauth', '5a7877d9-3663-4a57-b5e4-b73b50181dbe'),
	('3f9b4651-2368-4e8e-95aa-56001e5398dc', '2026-07-16 10:52:44.752501+00', '2026-07-16 10:52:44.752501+00', 'password', '1022fbaf-c0b5-410a-a16f-ef45b21f80c7'),
	('fbeab965-03ed-4250-960a-12030fcbc4bd', '2026-03-27 03:19:15.201029+00', '2026-03-27 03:19:15.201029+00', 'oauth', '94685ae4-658f-4757-85eb-c48b4620d1da'),
	('be105e3a-5dc4-401a-a55a-a91e05afa0d3', '2026-03-27 03:25:27.176395+00', '2026-03-27 03:25:27.176395+00', 'oauth', '3cfb72da-50c4-4fd1-8ae7-d51e319e24c5'),
	('22341295-1fa7-4529-a7a3-5d56fc2c5f65', '2026-06-24 09:40:55.006333+00', '2026-06-24 09:40:55.006333+00', 'oauth', '6e9f0752-eb0e-44a4-b2f5-aadb251a486f'),
	('63d95be7-68cf-4fe9-a818-9467f44e490c', '2026-05-07 05:12:50.913971+00', '2026-05-07 05:12:50.913971+00', 'oauth', '8ac37c8b-108a-478c-ac40-c8c076e7fcd1');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") VALUES
	('500f85d9-5cc2-49aa-9687-e38c605c507c', 'a4645a31-3068-463d-938d-3b02b583d5f1', 'phone_change_token', '42a3a294d23b3ce744d5777f9bc45f2ff5b9262f072310745960874d', '6588197184', '2026-07-05 14:42:35.563135', '2026-07-05 14:42:35.563135');


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 152, 'wnjkbve4lcoj', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', false, '2026-03-27 03:19:15.188348+00', '2026-03-27 03:19:15.188348+00', NULL, 'fbeab965-03ed-4250-960a-12030fcbc4bd'),
	('00000000-0000-0000-0000-000000000000', 634, 'tkvo2yp4kdbx', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', false, '2026-07-05 14:40:29.263488+00', '2026-07-05 14:40:29.263488+00', NULL, '5bdb25a6-a307-40bf-baef-aa921c2e2816'),
	('00000000-0000-0000-0000-000000000000', 315, 'vaq36mbhbjui', '0248644a-1206-4888-8289-7a0df5789d2c', false, '2026-04-11 16:46:00.249153+00', '2026-04-11 16:46:00.249153+00', NULL, '63697f7b-ae27-4360-b0b8-853047a08ef2'),
	('00000000-0000-0000-0000-000000000000', 638, '32fzuffqzo3z', 'a4645a31-3068-463d-938d-3b02b583d5f1', true, '2026-07-05 16:22:56.234151+00', '2026-07-05 17:21:26.537056+00', '7uhwus3tlr73', '31ee9808-6448-457d-a9b5-9ec252047009'),
	('00000000-0000-0000-0000-000000000000', 407, 'yneatb36gu67', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-05-08 08:46:11.176842+00', '2026-05-11 08:21:58.750703+00', '77f5el67xstb', '63d95be7-68cf-4fe9-a818-9467f44e490c'),
	('00000000-0000-0000-0000-000000000000', 679, 'vvkvh2eqdhqi', '71c422c5-ff93-495c-9f90-b8cf3e40d696', false, '2026-07-16 10:52:44.713257+00', '2026-07-16 10:52:44.713257+00', NULL, '3f9b4651-2368-4e8e-95aa-56001e5398dc'),
	('00000000-0000-0000-0000-000000000000', 329, 'ap3gbhmtdyjw', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-04-12 09:09:58.939743+00', '2026-04-12 10:07:58.584676+00', 'kfjmy3fw4dth', 'be105e3a-5dc4-401a-a55a-a91e05afa0d3'),
	('00000000-0000-0000-0000-000000000000', 680, 'tbz5l5cowpdk', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', false, '2026-07-16 10:52:58.854068+00', '2026-07-16 10:52:58.854068+00', '3vswlnk4ca4q', 'ae1782b7-f8ab-4557-914b-3a289983e104'),
	('00000000-0000-0000-0000-000000000000', 341, 'qwccigvchkbn', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-04-12 13:42:36.89286+00', '2026-04-13 01:06:53.33656+00', 'gv4ppajikdmj', 'be105e3a-5dc4-401a-a55a-a91e05afa0d3'),
	('00000000-0000-0000-0000-000000000000', 350, 'm454chahxofe', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', false, '2026-04-13 02:56:34.947472+00', '2026-04-13 02:56:34.947472+00', 'mjr7shwjbgad', 'be105e3a-5dc4-401a-a55a-a91e05afa0d3'),
	('00000000-0000-0000-0000-000000000000', 579, 'w6b2xttzcvxj', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', true, '2026-06-24 09:40:54.999235+00', '2026-06-24 10:45:05.324121+00', NULL, '22341295-1fa7-4529-a7a3-5d56fc2c5f65'),
	('00000000-0000-0000-0000-000000000000', 635, '7latcp5buamf', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', false, '2026-07-05 14:47:38.42905+00', '2026-07-05 14:47:38.42905+00', NULL, '29221ca7-18c2-4e28-9a0a-ce05b9f9eb43'),
	('00000000-0000-0000-0000-000000000000', 633, '6m3qizpu6wue', 'a4645a31-3068-463d-938d-3b02b583d5f1', true, '2026-07-05 14:26:25.919105+00', '2026-07-05 15:24:26.151731+00', NULL, '31ee9808-6448-457d-a9b5-9ec252047009'),
	('00000000-0000-0000-0000-000000000000', 423, 'nqnkmg2aswa6', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', false, '2026-05-11 08:21:58.787948+00', '2026-05-11 08:21:58.787948+00', 'yneatb36gu67', '63d95be7-68cf-4fe9-a818-9467f44e490c'),
	('00000000-0000-0000-0000-000000000000', 637, '7uhwus3tlr73', 'a4645a31-3068-463d-938d-3b02b583d5f1', true, '2026-07-05 15:24:26.182024+00', '2026-07-05 16:22:56.201011+00', '6m3qizpu6wue', '31ee9808-6448-457d-a9b5-9ec252047009'),
	('00000000-0000-0000-0000-000000000000', 639, '67omtx24njfi', 'a4645a31-3068-463d-938d-3b02b583d5f1', false, '2026-07-05 17:21:26.557171+00', '2026-07-05 17:21:26.557171+00', '32fzuffqzo3z', '31ee9808-6448-457d-a9b5-9ec252047009'),
	('00000000-0000-0000-0000-000000000000', 320, 'hbnzr6brkttb', '0248644a-1206-4888-8289-7a0df5789d2c', false, '2026-04-11 17:06:15.775982+00', '2026-04-11 17:06:15.775982+00', NULL, '205f45b5-8e78-43e4-969b-3f1e18cce959'),
	('00000000-0000-0000-0000-000000000000', 677, '3vswlnk4ca4q', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', true, '2026-07-15 12:16:47.492085+00', '2026-07-16 10:52:58.851409+00', NULL, 'ae1782b7-f8ab-4557-914b-3a289983e104'),
	('00000000-0000-0000-0000-000000000000', 324, 'go5wkxmtqxs7', '0248644a-1206-4888-8289-7a0df5789d2c', false, '2026-04-11 19:26:34.921792+00', '2026-04-11 19:26:34.921792+00', NULL, 'da256921-50f5-4511-96bb-c4629173bda1'),
	('00000000-0000-0000-0000-000000000000', 581, '357pj4sqlbbh', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', false, '2026-06-24 10:45:05.356693+00', '2026-06-24 10:45:05.356693+00', 'w6b2xttzcvxj', '22341295-1fa7-4529-a7a3-5d56fc2c5f65'),
	('00000000-0000-0000-0000-000000000000', 153, 'kfjmy3fw4dth', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-03-27 03:25:27.16676+00', '2026-04-12 09:09:58.914208+00', NULL, 'be105e3a-5dc4-401a-a55a-a91e05afa0d3'),
	('00000000-0000-0000-0000-000000000000', 406, '77f5el67xstb', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-05-07 05:12:50.894984+00', '2026-05-08 08:46:11.148233+00', NULL, '63d95be7-68cf-4fe9-a818-9467f44e490c'),
	('00000000-0000-0000-0000-000000000000', 332, 'sahamac6b5np', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-04-12 10:07:58.606421+00', '2026-04-12 12:44:20.133071+00', 'ap3gbhmtdyjw', 'be105e3a-5dc4-401a-a55a-a91e05afa0d3'),
	('00000000-0000-0000-0000-000000000000', 337, 'gv4ppajikdmj', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-04-12 12:44:20.143728+00', '2026-04-12 13:42:36.866372+00', 'sahamac6b5np', 'be105e3a-5dc4-401a-a55a-a91e05afa0d3'),
	('00000000-0000-0000-0000-000000000000', 349, 'mjr7shwjbgad', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', true, '2026-04-13 01:06:53.364769+00', '2026-04-13 02:56:34.928165+00', 'qwccigvchkbn', 'be105e3a-5dc4-401a-a55a-a91e05afa0d3');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."app_settings" ("id", "required_walks_per_round", "created_at", "updated_at", "max_media_per_report", "high_participation_threshold", "reminder_send_weekday", "reminder_send_time", "reminder_window_start_offset_days", "reminder_window_length_days") VALUES
	('9b1fe76f-9b3b-42f0-acf9-a9e8e524f461', 3, '2026-02-21 10:33:06.672319+00', '2026-05-28 10:10:35.683883+00', 10, 3, 3, '13:00:00', 2, 7);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "role", "status", "created_at", "updated_at", "phone_number", "phone_verified_at", "guardian_name", "guardian_email", "guardian_email_verified_at", "birth_month") VALUES
	('0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', 'kjaehyeok21@gmail.com', 'Kim Jae Hyeok', NULL, 'ADMIN', 'ACTIVE', '2026-02-21 11:01:38.859889+00', '2026-07-05 14:30:26.176146+00', NULL, NULL, NULL, NULL, NULL, '2002-01-01'),
	('9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'trcosine@gmail.com', 'Ng Kheng Yang (alt)', 'https://lh3.googleusercontent.com/a/ACg8ocK89Me0hgvvCSSHLq1NYF5wFml-eNivp8n0lEUAJq-O1SkfS20=s96-c', 'VOLUNTEER', 'ACTIVE', '2026-07-07 14:10:35.794592+00', '2026-07-07 15:22:46.243377+00', '+6599887766', '2026-07-07 14:31:04.414119+00', NULL, NULL, NULL, '2020-01-01'),
	('888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'alice@primap.demo', 'Alice', NULL, 'VOLUNTEER', 'ACTIVE', '2026-04-11 16:05:38.091677+00', '2026-04-11 16:08:10.606506+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('cc60e20c-0986-4157-a153-1c62e0c76042', 'bob@primap.demo', 'Bob', NULL, 'VOLUNTEER', 'ACTIVE', '2026-04-11 16:05:51.534283+00', '2026-04-11 16:08:13.3116+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('56823340-0cb5-4679-aab3-8fa552178a90', 'charlie@primap.demo', 'Charlie', NULL, 'VOLUNTEER', 'ACTIVE', '2026-04-11 16:06:11.141729+00', '2026-04-11 16:08:17.60669+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('ef71f1fa-d448-4c9f-9b10-76a559bb8069', 'dan@primap.demo', 'Dan', NULL, 'VOLUNTEER', 'ACTIVE', '2026-04-11 16:06:29.492823+00', '2026-04-11 16:08:20.038295+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('a4645a31-3068-463d-938d-3b02b583d5f1', 'kjaehyeok020125@gmail.com', 'Jay Kim', NULL, 'VOLUNTEER', 'PENDING', '2026-07-05 14:25:40.511243+00', '2026-07-05 14:42:35.695376+00', '+6588197184', NULL, NULL, NULL, NULL, '2012-01-01'),
	('c42a5bc3-7895-4485-8692-d1b235da6b49', 'fred@primap.demo', 'Fred', NULL, 'VOLUNTEER', 'PENDING', '2026-04-12 14:15:36.425729+00', '2026-04-12 14:16:23.527536+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('fe1570e8-c7e9-47ad-b4cc-41cfcd6105f8', 'emily@primap.demo', 'Emily', NULL, 'VOLUNTEER', 'PENDING', '2026-04-12 14:15:19.880359+00', '2026-04-12 14:16:27.008776+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('71c422c5-ff93-495c-9f90-b8cf3e40d696', 'admin@primap.demo', 'Dr. Andie', NULL, 'ADMIN', 'ACTIVE', '2026-04-11 16:05:09.886411+00', '2026-04-13 06:52:34.655211+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('51b1cf99-e8c3-4c9a-8143-6be06b6dba70', 'bobtest972@gmail.com', NULL, NULL, 'VOLUNTEER', 'ACTIVE', '2026-05-11 06:47:42.00801+00', '2026-05-11 07:17:49.770666+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('ec26112d-5f65-4666-9d40-5fb222f55dbf', 'seanlimdev856@gmail.com', 'Sean', NULL, 'ADMIN', 'ACTIVE', '2026-02-24 16:42:18.794229+00', '2026-05-11 08:34:12.868354+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'macdonaldbenny1@gmail.com', 'Sneaky Owl', 'https://lh3.googleusercontent.com/a/ACg8ocJ0qfa9rchSfl5KqVf2JeWc7FxYSef4IZTMOdCHwEVBAHvXRLso=s96-c', 'VOLUNTEER', 'ACTIVE', '2026-05-28 05:34:19.7404+00', '2026-05-28 05:35:42.396365+00', NULL, NULL, NULL, NULL, NULL, NULL),
	('4406c55b-09b6-4f82-8975-6bffe8886513', 'ngkhengyang@gmail.com', 'Ng Kheng Yang', 'https://lh3.googleusercontent.com/a/ACg8ocKKe1Z0kiGHvBsue_CFIa40iox7RhqweB172zDbEAnfx7DuzhbQ=s96-c', 'ADMIN', 'ACTIVE', '2026-05-20 18:29:54.058385+00', '2026-07-07 09:03:17.015824+00', '+6597868371', '2026-07-07 08:39:58.116+00', NULL, NULL, NULL, '2002-01-01');


--
-- Data for Name: survey_rounds; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."survey_rounds" ("id", "name", "description", "start_date", "end_date", "status", "created_by", "created_at", "updated_at", "indemnity_form_url") VALUES
	('d2a7b401-b4ad-451f-9fcd-a09e6b89f267', 'Round Beta', 'round_beta_description', '2025-07-01', '2025-12-31', 'CLOSED', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '2026-04-11 16:12:07.042351+00', '2026-04-11 17:17:06.179336+00', NULL),
	('72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Round Alpha', 'round_alpha_description', '2026-01-01', '2026-06-30', 'OPEN', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '2026-04-11 16:11:44.980132+00', '2026-07-05 13:33:50.195818+00', 'https://docs.google.com/forms/d/e/1FAIpQLSeyEo0vrWJVWliNvA5Q9xaz1CX7dimhJlRYUbojbbLO9ewtBQ/viewform'),
	('d0fcd1da-8664-4d11-b660-317be7479c8f', 'Round Gamma', 'round_gamma_description', '2026-07-01', '2026-12-31', 'OPEN', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '2026-06-28 05:01:24.311824+00', '2026-07-05 13:33:50.195818+00', 'https://docs.google.com/forms/d/e/1FAIpQLSeyEo0vrWJVWliNvA5Q9xaz1CX7dimhJlRYUbojbbLO9ewtBQ/viewform');


--
-- Data for Name: guardian_contact_otps; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."guardian_contact_otps" ("id", "user_id", "channel", "destination", "code_hash", "attempts", "expires_at", "verified_at", "created_at", "updated_at", "round_id") VALUES
	('bfc3561a-6261-4bfb-9dc1-b08849f87c5e', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'EMAIL', 'ngkhengyang@gmail.com', 'aa3d61378e1b6aff1f351e8d0a882b781b6b4fb3c284c22612ca80f7a1a083d8', 0, '2026-07-07 15:55:12.713+00', NULL, '2026-07-07 15:45:12.713+00', '2026-07-07 15:45:12.713+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('a8475612-ea9e-40fa-882d-83585403fbc4', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'EMAIL', 'ngkhengyang@gmail.com', 'f0808ec4e3cfd777e7deaeda7dbfb5aa49e295991af0ddaaa55c7e21f0ea8394', 0, '2026-07-07 16:08:59.561+00', NULL, '2026-07-07 15:58:59.561+00', '2026-07-07 15:58:59.561+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('cc933c22-3af8-4c9f-879e-aa3fef809486', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'EMAIL', 'ngkhengyang@gmail.com', 'd1c78fc173e97097846d0225a55fd7da4bd97feebae4aa4b1f57119674baafcc', 0, '2026-07-07 16:10:47.084+00', NULL, '2026-07-07 16:00:47.084+00', '2026-07-07 16:00:47.084+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('2cd85dbb-65cb-433b-9adb-8829edf00222', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'EMAIL', 'ngkhengyang@gmail.com', '136b716fe623b90e35bd61c51a0da932c21e7bb6728998ecbeb7be565eeb210f', 0, '2026-07-07 16:11:55.681+00', NULL, '2026-07-07 16:01:55.681+00', '2026-07-07 16:01:55.681+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('478130f1-5c19-4587-acd7-00138b289e32', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'EMAIL', 'ngkhengyang@gmail.com', '398b34644c03f7707ddd9257e5a9ec0df78792d1c6b869b2b9985c2dccbea875', 0, '2026-07-08 04:18:35.276+00', NULL, '2026-07-08 04:08:35.276+00', '2026-07-08 04:08:35.276+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('739dcc6d-93ef-487b-8ed3-11dad1f5e507', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'EMAIL', 'ngkhengyang@gmail.com', '18ae5297229305d5bb865ecc802fa79e67c3642aff6eecbb43dc80e0b313ec5b', 1, '2026-07-08 06:37:01.335+00', NULL, '2026-07-08 06:27:01.335+00', '2026-07-08 06:27:04.336+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('cc53a409-5a42-4a99-9326-4a2497136d9a', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'EMAIL', 'ngkhengyang@gmail.com', '26f1e86e455317c1b0de707557dfd36c8497a6e286d57e983fdc9c994bc4c52b', 0, '2026-07-08 06:38:53.604+00', '2026-07-08 06:28:57.243+00', '2026-07-08 06:28:53.604+00', '2026-07-08 06:28:57.243+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('ab5aad13-f026-44f0-9f71-5a124c29b599', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'SMS', '+6597868371', '8b3d5ddf6a0696e14b1f6e83b06f1566d495a6fa0f84597131b517b617b53bc1', 2, '2026-07-08 06:37:15.684+00', NULL, '2026-07-08 06:27:15.684+00', '2026-07-08 06:29:02.529+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f'),
	('a4826cc7-b11e-4c63-808c-af9d8ed0035f', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'SMS', '+6597868371', '4a9978927498a5c13ceda892f0eeef8187ae157375e5bf7d3ca0c06536659da6', 0, '2026-07-08 06:39:05.058+00', '2026-07-08 06:29:09.18+00', '2026-07-08 06:29:05.058+00', '2026-07-08 06:29:09.18+00', 'd0fcd1da-8664-4d11-b660-317be7479c8f');


--
-- Data for Name: walk_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."walk_slots" ("id", "round_id", "location_name", "walk_date", "start_time", "end_time", "max_volunteers", "created_at", "updated_at", "reminder_sent_at") VALUES
	('9a9ad23f-06ad-4097-a37e-70ada94b51f1', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-16', '12:00:00', '15:00:00', 3, '2026-07-15 11:15:20.273071+00', '2026-07-15 11:15:20.273071+00', NULL),
	('d1c7caad-af1d-40b6-8fa6-2b528ca8ad8c', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Windsor Nature Park', '2026-06-26', '15:00:00', '18:00:00', 3, '2026-06-24 07:10:28.68903+00', '2026-06-24 09:48:36.886759+00', '2026-06-24 09:48:36.766+00'),
	('6f6bf323-9a62-4a4a-81db-dab64b5eb13a', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Windsor Nature Park', '2026-06-27', '15:00:00', '18:00:00', 3, '2026-06-24 07:10:28.68903+00', '2026-06-24 09:48:37.020012+00', '2026-06-24 09:48:36.958+00'),
	('756de038-6ea5-4455-893c-64e139a5478e', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Windsor Nature Park', '2026-06-29', '07:00:00', '10:00:00', 3, '2026-06-24 10:08:41.328343+00', '2026-06-24 10:09:16.674623+00', '2026-06-24 10:09:16.634+00'),
	('d4dc4a6e-f5f5-4c9c-bad7-211494662c07', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-17', '12:00:00', '15:00:00', 3, '2026-07-15 11:15:20.273071+00', '2026-07-15 11:15:20.273071+00', NULL),
	('52ee3a01-2577-47bb-8136-8c8f4ccfde07', 'd2a7b401-b4ad-451f-9fcd-a09e6b89f267', 'Windsor Nature Park', '2025-12-22', '07:00:00', '10:00:00', 3, '2026-04-11 16:16:51.812681+00', '2026-04-12 14:01:56.993731+00', NULL),
	('33104d62-71a1-4a28-ae5a-a98352fcf80d', 'd2a7b401-b4ad-451f-9fcd-a09e6b89f267', 'Rifle Range Nature Park', '2025-12-29', '07:00:00', '10:00:00', 3, '2026-04-11 16:17:08.871952+00', '2026-04-12 14:02:01.377976+00', NULL),
	('67900344-3562-4e0e-8abe-559355e9e3cb', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-03-16', '07:00:00', '10:00:00', 3, '2026-04-11 16:16:06.45295+00', '2026-04-12 14:02:05.464654+00', NULL),
	('709d6317-26f6-4a95-b410-9eda24ef1820', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Lower Peirce Reservoir Park', '2026-03-23', '07:00:00', '10:00:00', 3, '2026-04-11 16:16:20.872645+00', '2026-04-12 14:02:09.192794+00', NULL),
	('bbdbe4b5-62e5-4b91-9225-adb359a98037', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Windsor Nature Park', '2026-06-28', '15:00:00', '18:00:00', 3, '2026-06-24 07:10:28.68903+00', '2026-06-24 10:29:13.38147+00', '2026-06-24 09:44:39.046+00'),
	('7813828b-ff60-4c4e-b997-c4fc916a04a0', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-06-27', '07:00:00', '10:00:00', 3, '2026-06-26 05:21:38.669026+00', '2026-06-26 05:21:38.669026+00', NULL),
	('cd36b3b3-d954-44c5-8811-4e86f5a5eb36', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Upper Peirce Reservoir Park', '2026-04-14', '07:00:00', '10:00:00', 3, '2026-04-11 16:16:31.474101+00', '2026-04-12 14:03:02.539235+00', NULL),
	('c0ac789a-4a02-47c4-8a49-a47a39220061', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-06-28', '07:00:00', '10:00:00', 3, '2026-06-26 05:21:38.669026+00', '2026-06-26 05:21:38.669026+00', NULL),
	('3a78fc15-9661-42f7-82ad-44f61b3c64f9', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-05-04', '07:00:00', '10:00:00', 3, '2026-04-12 11:14:54.815046+00', '2026-04-16 11:43:22.130327+00', NULL),
	('66c5b9df-2d86-4b88-b0b8-41513c0fb5fa', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Lower Peirce Reservoir Park', '2026-05-11', '07:00:00', '10:00:00', 3, '2026-04-11 19:28:05.820739+00', '2026-04-16 11:43:37.369723+00', NULL),
	('846c0897-3abd-4ef8-8f2d-8dcba3622731', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Upper Peirce Reservoir Park', '2026-05-18', '07:00:00', '10:00:00', 3, '2026-04-16 11:43:50.814823+00', '2026-04-16 11:43:50.814823+00', NULL),
	('d0813041-5b11-44fd-94ea-2f270bb03b89', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-06-29', '07:00:00', '10:00:00', 3, '2026-06-26 05:21:38.669026+00', '2026-06-26 05:21:38.669026+00', NULL),
	('162a8664-9d9a-4766-a31d-26b08635647c', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-05-25', '09:00:00', '12:00:00', 3, '2026-05-21 19:39:46.310711+00', '2026-05-21 19:39:46.310711+00', NULL),
	('76e524f5-b2b6-47aa-b160-101bb2bf364b', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-05-26', '09:00:00', '12:00:00', 3, '2026-05-21 19:39:46.310711+00', '2026-05-21 19:39:46.310711+00', NULL),
	('61d93dfa-7211-499b-b102-5d428836383f', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-05-27', '09:00:00', '12:00:00', 3, '2026-05-21 19:39:46.310711+00', '2026-05-21 19:39:46.310711+00', NULL),
	('da882e0d-8b11-4139-a992-ab5726cc3bfb', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-06-01', '09:00:00', '12:00:00', 3, '2026-05-21 19:39:46.310711+00', '2026-05-21 19:39:46.310711+00', NULL),
	('1f794db8-5c55-422e-b9f0-e37f3aca5959', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-06-02', '09:00:00', '12:00:00', 3, '2026-05-21 19:39:46.310711+00', '2026-05-21 19:39:46.310711+00', NULL),
	('2efad287-4719-42e6-8d18-723641afb728', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-05-28', '21:00:00', '23:00:00', 3, '2026-05-28 10:06:30.778554+00', '2026-05-28 10:06:30.778554+00', NULL),
	('0113b3e6-d77a-4ce3-bff0-5109cddf04d9', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-06-04', '10:00:00', '13:00:00', 3, '2026-05-21 19:39:46.310711+00', '2026-06-02 08:12:32.623977+00', NULL),
	('c1fd548e-45fa-405c-b8d3-94fec1613966', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Upper Pierce Reservoir Park', '2026-06-06', '07:00:00', '10:00:00', 3, '2026-06-03 18:57:22.562268+00', '2026-06-03 18:57:22.562268+00', NULL),
	('d1c9d8f4-8c1a-470e-9291-76e8a2781f46', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-06-10', '11:00:00', '14:00:00', 3, '2026-06-03 18:58:41.74799+00', '2026-06-03 18:58:41.74799+00', NULL),
	('5e7b7335-36aa-40ff-9f18-15a62e16b617', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-06-15', '11:00:00', '14:00:00', 3, '2026-06-03 18:58:41.74799+00', '2026-06-03 18:58:41.74799+00', NULL),
	('c20018e4-0221-4beb-b396-c26ea28ca7e8', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Bt Timah', '2026-05-12', '07:00:00', '10:00:00', 3, '2026-05-11 06:53:55.264891+00', '2026-06-13 03:06:33.288178+00', NULL),
	('ed6d58d2-e216-4ca9-a2e4-995966564f2e', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-03-23', '07:00:00', '10:00:00', 3, '2026-06-21 19:02:07.008421+00', '2026-06-21 19:02:07.008421+00', NULL),
	('f481580a-353f-48d6-a83e-d5fc014ce11c', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-02-09', '07:00:00', '10:00:00', 3, '2026-06-21 19:02:30.298828+00', '2026-06-21 19:02:30.298828+00', NULL),
	('023cecf9-3bc8-4dda-847a-2a5b1497beb5', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-06-30', '07:00:00', '10:00:00', 3, '2026-06-26 05:21:38.669026+00', '2026-06-26 05:21:38.669026+00', NULL),
	('943ee3b0-d894-4df4-9d48-e7d708eb1c50', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-06-27', '12:00:00', '15:00:00', 3, '2026-06-26 05:22:14.891877+00', '2026-06-26 05:22:14.891877+00', NULL),
	('0b6f4eda-a939-4e38-b1b8-7a98081c8a7f', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Rifle Range Nature Park', '2026-06-25', '07:00:00', '10:00:00', 3, '2026-06-24 06:14:49.017023+00', '2026-06-24 06:14:49.017023+00', NULL),
	('fc758f70-218e-45b5-90e5-fcd1ba16649f', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-06-28', '12:00:00', '15:00:00', 3, '2026-06-26 05:22:14.891877+00', '2026-06-26 05:22:14.891877+00', NULL),
	('e58b2677-d73a-48da-863d-31aa6cef87a3', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-06-29', '12:00:00', '15:00:00', 3, '2026-06-26 05:22:14.891877+00', '2026-06-26 05:22:14.891877+00', NULL),
	('bea67018-671f-4968-90be-70f64c7849fc', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', 'Thomson Nature Park', '2026-06-30', '12:00:00', '15:00:00', 3, '2026-06-26 05:22:14.891877+00', '2026-06-26 05:22:14.891877+00', NULL),
	('c697c9e6-8aba-44ab-ac10-6f3c79b56246', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-06', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('9beef3f8-b47e-40eb-bf48-bea92b77face', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-06', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('5f0e73f6-fa67-4ee6-94f5-64959e507818', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-07', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('baab59fe-ffc2-4d7f-96af-1db972588f96', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-07', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('2863ff2d-3fca-45a6-915f-a2716fdc31ae', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-08', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('00d58acd-f74d-4e62-b658-b51b772b1195', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-08', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('cefc8f26-fed3-42f9-80bd-1ef79c039bc4', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-09', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('30870c63-02d2-44e8-b7ee-daec0375d242', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-09', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('825278bd-5d21-4027-bc47-68db6e4341a6', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-10', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('c1f7b465-0857-4c54-945f-4fce3c5904e0', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-10', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('85777094-641a-4c49-8d5d-3091d288528e', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-11', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('a97bec8a-3907-4bee-95dd-bb1b0a6bb685', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-11', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('8bc437a3-c8c1-46a9-863c-3bc55224c099', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-12', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('23987bd7-241a-4e37-87ab-94279780b1f8', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-12', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('560fb3ea-163d-4b44-b3ac-5daa0bb66f6c', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-13', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('521110ae-22e2-4d4f-a634-2a6ca259ad41', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Thomson Nature Park', '2026-07-13', '07:00:00', '10:00:00', 3, '2026-06-28 05:03:28.271849+00', '2026-06-28 05:03:28.271849+00', NULL),
	('1e9bcdd7-a966-4aac-a0ac-1b185f31a6c0', 'd0fcd1da-8664-4d11-b660-317be7479c8f', 'Rifle Range Nature Park', '2026-07-18', '12:00:00', '15:00:00', 3, '2026-07-15 11:15:20.273071+00', '2026-07-15 11:15:20.273071+00', NULL);


--
-- Data for Name: incidents; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."incidents" ("id", "slot_id", "reported_by", "incident_type", "description", "lat", "lng", "resolved", "resolved_notes", "created_at", "updated_at") VALUES
	('97d45f21-9f57-4b9c-969d-19f52e879d78', '67900344-3562-4e0e-8abe-559355e9e3cb', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'HABITAT_DAMAGE', 'Observed signs of habitat damage, which may impact wildlife activity.', NULL, NULL, false, NULL, '2026-04-11 16:55:15.992733+00', '2026-04-11 16:55:15.992733+00');


--
-- Data for Name: observations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."observations" ("id", "slot_id", "user_id", "walk_completion", "outcome", "notes", "lat", "lng", "status", "client_draft_id", "submitted_at", "created_at", "updated_at", "last_user_agent", "completion_comment") VALUES
	('82abc1d4-f3d7-49b0-9a17-c0ce134d9f8f', '756de038-6ea5-4455-893c-64e139a5478e', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-24 10:09:02.097505+00', '2026-06-24 10:09:02.097505+00', NULL, NULL),
	('7fe4444a-bd0e-41e8-a1a1-d56135f42072', 'd1c7caad-af1d-40b6-8fa6-2b528ca8ad8c', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-24 10:23:42.770205+00', '2026-06-24 10:23:42.770205+00', NULL, NULL),
	('57b6a9ee-58bf-465a-8d28-c46077c89d1f', '33104d62-71a1-4a28-ae5a-a98352fcf80d', 'ef71f1fa-d448-4c9f-9b10-76a559bb8069', 'COMPLETED', 'NOT_SIGHTED', 'No sightings.', 1.344970751742693, 103.78312211402363, 'SUBMITTED', NULL, '2026-04-11 16:52:34.528+00', '2026-04-11 16:35:06.283073+00', '2026-04-11 16:52:34.552422+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', NULL),
	('9c9009be-f0e2-47d1-b782-3c686387653c', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', 'COMPLETED', 'SIGHTED', NULL, NULL, NULL, 'SUBMITTED', NULL, '2026-05-11 19:15:06.51+00', '2026-05-11 19:07:00.754798+00', '2026-05-11 19:15:06.543907+00', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1', NULL),
	('b62bd06c-5683-4ad1-b555-2d103c68a051', '709d6317-26f6-4a95-b410-9eda24ef1820', '56823340-0cb5-4679-aab3-8fa552178a90', 'COMPLETED', 'SIGHTED', NULL, NULL, NULL, 'SUBMITTED', NULL, '2026-04-11 16:48:58.944+00', '2026-04-11 16:34:26.098825+00', '2026-04-11 16:48:58.968425+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', NULL),
	('55b6ed84-4165-41c1-a8f7-08529f70ce24', 'cd36b3b3-d954-44c5-8811-4e86f5a5eb36', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'PARTIAL', 'SIGHTED', NULL, NULL, NULL, 'SUBMITTED', NULL, '2026-04-13 07:07:44.972+00', '2026-04-13 07:04:18.837149+00', '2026-04-13 07:07:45.025423+00', 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', NULL),
	('6e1fdb03-d4bc-4d45-8fa9-87c583c0210e', '3a78fc15-9661-42f7-82ad-44f61b3c64f9', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-04-13 07:15:05.456419+00', '2026-04-13 07:15:05.456419+00', NULL, NULL),
	('39da2398-b938-4051-973f-87f7b3bee6f2', '67900344-3562-4e0e-8abe-559355e9e3cb', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'COMPLETED', 'SIGHTED', NULL, NULL, NULL, 'SUBMITTED', NULL, '2026-04-11 16:43:52.851+00', '2026-04-11 16:23:57.048437+00', '2026-04-11 16:43:52.880165+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', NULL),
	('20fb30f3-de88-4af6-8d8e-b321d2ee1501', '5e7b7335-36aa-40ff-9f18-15a62e16b617', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-10 08:35:50.825821+00', '2026-06-10 08:35:50.825821+00', NULL, NULL),
	('98b01e5a-4288-45d6-bfb0-01607179a5b2', '6f6bf323-9a62-4a4a-81db-dab64b5eb13a', '4406c55b-09b6-4f82-8975-6bffe8886513', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-26 05:33:04.376116+00', '2026-06-26 05:33:04.376116+00', NULL, NULL),
	('8882963f-9009-404a-9173-2edd4b123d94', '67900344-3562-4e0e-8abe-559355e9e3cb', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'COMPLETED', 'SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-04-11 16:57:09.358781+00', '2026-04-12 13:43:59.884415+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', NULL),
	('de18acdd-8b97-4c77-b979-b870b2e62246', '709d6317-26f6-4a95-b410-9eda24ef1820', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'COMPLETED', 'NOT_SIGHTED', 'No sightings.', 1.372310540281859, 103.82581007052113, 'SUBMITTED', NULL, '2026-04-11 16:45:30.407+00', '2026-04-11 16:24:02.484824+00', '2026-04-11 16:45:30.428973+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', NULL),
	('3032d059-c7ed-4ec4-b36a-f155635cecde', '52ee3a01-2577-47bb-8136-8c8f4ccfde07', '56823340-0cb5-4679-aab3-8fa552178a90', 'COMPLETED', 'SIGHTED', NULL, NULL, NULL, 'SUBMITTED', NULL, '2026-04-11 16:51:07.296+00', '2026-04-11 16:34:36.132308+00', '2026-04-11 16:51:07.32192+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', NULL),
	('52d1c887-058a-4014-8c86-372d6fbdcc71', '756de038-6ea5-4455-893c-64e139a5478e', '4406c55b-09b6-4f82-8975-6bffe8886513', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-26 05:33:23.291194+00', '2026-06-26 05:33:23.291194+00', NULL, NULL),
	('18acc209-aba1-4914-8770-f5f564e01b4f', '2863ff2d-3fca-45a6-915f-a2716fdc31ae', '4406c55b-09b6-4f82-8975-6bffe8886513', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 05:17:06.374419+00', '2026-06-28 05:17:06.374419+00', NULL, NULL),
	('7cdb514f-33c4-4495-8eab-fea6105e07a3', 'cd36b3b3-d954-44c5-8811-4e86f5a5eb36', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ABORTED', 'SIGHTED', 'ssdsdsdsdsdsdsd', NULL, NULL, 'DRAFT', NULL, NULL, '2026-04-11 16:24:09.540185+00', '2026-04-14 09:01:28.378093+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', NULL),
	('cc90a91d-17b3-4b56-899e-94148ec99900', '709d6317-26f6-4a95-b410-9eda24ef1820', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'PARTIAL', 'SIGHTED', 'dsafklasdf', NULL, NULL, 'DRAFT', NULL, NULL, '2026-04-11 16:31:50.057228+00', '2026-04-13 08:27:27.02445+00', 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', NULL),
	('57673137-4a75-4306-b2d2-619f4dc9396e', 'cd36b3b3-d954-44c5-8811-4e86f5a5eb36', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'COMPLETED', 'SIGHTED', 'Admin correction: updated count for RBL sighting.', NULL, NULL, 'SUBMITTED', NULL, '2026-04-11 16:59:24.787+00', '2026-04-11 16:57:53.828681+00', '2026-04-13 09:53:49.061899+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', NULL),
	('742cf8d3-f1d1-47fe-916d-b953a553e9ac', '3a78fc15-9661-42f7-82ad-44f61b3c64f9', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', 'PARTIAL', 'SIGHTED', NULL, NULL, NULL, 'SUBMITTED', NULL, '2026-04-13 09:46:26.995+00', '2026-04-13 09:44:14.990859+00', '2026-05-10 09:10:15.373393+00', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36', 'Rain started midway'),
	('44667de4-f64b-44b7-b0f3-34288bc2091e', '846c0897-3abd-4ef8-8f2d-8dcba3622731', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-05-11 06:51:08.187553+00', '2026-05-11 06:51:08.187553+00', NULL, NULL),
	('cac4b285-b6e0-46c2-a0b6-de60bf45c5ff', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-05-11 06:54:17.44794+00', '2026-05-11 06:54:17.44794+00', NULL, NULL),
	('d18a1d9b-2461-4f51-8381-67a5dced1ba0', 'cefc8f26-fed3-42f9-80bd-1ef79c039bc4', '4406c55b-09b6-4f82-8975-6bffe8886513', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 05:17:16.771729+00', '2026-06-28 05:17:16.771729+00', NULL, NULL),
	('bb288e52-f494-41a9-8be1-3d8801666268', '3a78fc15-9661-42f7-82ad-44f61b3c64f9', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-04-14 05:59:40.143423+00', '2026-04-14 05:59:40.143423+00', NULL, NULL),
	('edd481f6-ac8c-4954-ba24-1779cc8b57cf', '00d58acd-f74d-4e62-b658-b51b772b1195', '4406c55b-09b6-4f82-8975-6bffe8886513', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 05:19:14.839549+00', '2026-06-28 05:19:14.839549+00', NULL, NULL),
	('9e79d656-fd75-49a8-b8dd-848eaaf4aeb0', '2863ff2d-3fca-45a6-915f-a2716fdc31ae', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 06:46:43.367668+00', '2026-06-28 06:46:43.367668+00', NULL, NULL),
	('56917e7b-16aa-4b01-9352-a70ddb71df67', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', '51b1cf99-e8c3-4c9a-8143-6be06b6dba70', 'PARTIAL', 'SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-05-11 07:18:42.8064+00', '2026-06-22 14:19:12.094365+00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL),
	('a5be2d4e-3542-4da7-a8c7-42c12b8208e2', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', 'PARTIAL', 'SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-05-11 08:36:13.248131+00', '2026-05-11 08:36:43.998707+00', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', NULL),
	('848c782b-ffea-4333-8a72-1e6b210d106b', '00d58acd-f74d-4e62-b658-b51b772b1195', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 06:46:56.930804+00', '2026-06-28 06:46:56.930804+00', NULL, NULL),
	('c40d267b-5cb7-4cbc-a02a-cb9b94ed0c9f', '0b6f4eda-a939-4e38-b1b8-7a98081c8a7f', '4406c55b-09b6-4f82-8975-6bffe8886513', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-24 06:15:05.42867+00', '2026-06-24 06:15:05.42867+00', NULL, NULL),
	('5af21920-70e0-4a76-957e-956dc320a19f', 'bbdbe4b5-62e5-4b91-9225-adb359a98037', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-24 09:54:34.297777+00', '2026-06-24 09:54:34.297777+00', NULL, NULL),
	('5401b2cc-77c0-4966-85fa-c4fdf9dbc6cb', '6f6bf323-9a62-4a4a-81db-dab64b5eb13a', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-24 10:06:51.75245+00', '2026-06-24 10:06:51.75245+00', NULL, NULL),
	('89d71fce-3b1f-41ec-bd02-1bef59e24480', '2863ff2d-3fca-45a6-915f-a2716fdc31ae', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 06:47:21.810591+00', '2026-06-28 06:47:21.810591+00', NULL, NULL),
	('a4ac6176-5f63-4de2-bf70-37b0bf064d60', 'bbdbe4b5-62e5-4b91-9225-adb359a98037', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 06:47:40.773678+00', '2026-06-28 06:47:40.773678+00', NULL, NULL),
	('67a6247e-39e7-40df-b3be-31c2382e5a13', '00d58acd-f74d-4e62-b658-b51b772b1195', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 06:50:48.049076+00', '2026-06-28 06:50:48.049076+00', NULL, NULL),
	('c24e1604-d746-4d7f-be12-7b18913a95c8', '825278bd-5d21-4027-bc47-68db6e4341a6', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-06-28 06:50:56.312497+00', '2026-06-28 06:50:56.312497+00', NULL, NULL),
	('a09bbb3c-ce41-4ff8-b361-a149711e76c2', '9a9ad23f-06ad-4097-a37e-70ada94b51f1', '4406c55b-09b6-4f82-8975-6bffe8886513', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-07-15 11:15:36.30917+00', '2026-07-15 11:15:36.30917+00', NULL, NULL),
	('f416ba60-a496-4c07-bca2-4e90fa46b80f', '9a9ad23f-06ad-4097-a37e-70ada94b51f1', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'PARTIAL', 'NOT_SIGHTED', NULL, NULL, NULL, 'DRAFT', NULL, NULL, '2026-07-15 11:16:06.791317+00', '2026-07-15 11:16:06.791317+00', NULL, NULL);


--
-- Data for Name: sightings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."sightings" ("id", "observation_id", "species", "count", "observed_at", "lat", "lng", "notes", "created_at", "species_other") VALUES
	('d3aa93d8-a3e9-478b-afe5-fab9ff918692', '55b6ed84-4165-41c1-a8f7-08529f70ce24', 'RBL', '1', '2026-04-13 15:05:00+00', 1.349335511133944, 103.8312298146289, 'asdfasdfnasdfjasdfadsf', '2026-04-13 07:05:36.222745+00', NULL),
	('5b9bb001-6d44-4b01-9a38-ac8d480d0033', '3032d059-c7ed-4ec4-b36a-f155635cecde', 'DUSKY', '4', '2026-04-12 00:49:00+00', 1.3562498155269935, 103.82031098590113, 'Climbing up tree trunk slowly.', '2026-04-11 16:49:43.01021+00', NULL),
	('be7e2cfd-a519-439f-966e-e6b914dc6e7a', '3032d059-c7ed-4ec4-b36a-f155635cecde', 'RBL', '2', '2026-04-12 00:49:00+00', 1.3576403238378418, 103.82220748540306, 'Playing and chasing within the group.', '2026-04-11 16:50:35.915322+00', NULL),
	('9fd7dbf6-57e9-40d4-9a98-3a9b96b60a16', 'cc90a91d-17b3-4b56-899e-94148ec99900', 'RBL', '1', '2026-04-13 15:17:00+00', 1.3486489871796152, 103.83133352818777, NULL, '2026-04-13 07:17:27.610446+00', NULL),
	('4da6ec90-de85-4359-8e0e-fe1e48c8b891', '56917e7b-16aa-4b01-9352-a70ddb71df67', 'RBL', '1', '2026-06-21 22:41:00+00', 0, 0, NULL, '2026-06-21 14:41:27.614178+00', NULL),
	('f9e4b880-8350-4afe-a574-a0deed411207', '39da2398-b938-4051-973f-87f7b3bee6f2', 'RBL', '1', '2026-04-12 00:36:00+00', 1.383728690688713, 103.82194849747827, 'Feeding on leaves in the canopy.', '2026-04-11 16:36:44.461036+00', NULL),
	('c1fe4d83-7349-441e-bedc-bdfeecd906bf', '39da2398-b938-4051-973f-87f7b3bee6f2', 'LTM', '1', '2026-04-12 00:36:00+00', 1.3831072138206366, 103.82300069696265, 'Resting on tree branch with minimal movement.', '2026-04-11 16:40:28.673695+00', NULL),
	('6ec52b58-c855-41ab-b44c-ec69bc2f2dee', '39da2398-b938-4051-973f-87f7b3bee6f2', 'DUSKY', '1', '2026-04-12 00:36:00+00', 1.3819682528031336, 103.82163136162842, 'Moving quickly across trees from left to right.', '2026-04-11 16:41:03.60088+00', NULL),
	('ee26ff4c-5523-4606-ad28-23385d31e916', '39da2398-b938-4051-973f-87f7b3bee6f2', 'OTHER', '1', '2026-04-12 00:41:00+00', 1.382641610664649, 103.82418364068695, 'Small squirrel on tree.', '2026-04-11 16:41:47.564533+00', 'Plantain squirrel'),
	('4b4c2ffc-e74b-4ce7-bc45-4a601ab8bc41', '57673137-4a75-4306-b2d2-619f4dc9396e', 'RBL', '2', '2026-04-12 00:58:00+00', 1.37305450538925, 103.812085724354, 'Foraging on the ground briefly.', '2026-04-11 16:58:19.166723+00', NULL),
	('2ca59963-860e-4290-a21e-e994bbc21070', '57673137-4a75-4306-b2d2-619f4dc9396e', 'LTM', '5', '2026-04-12 00:58:00+00', 1.37171694569172, 103.812936249853, 'Playing and chasing within the group.', '2026-04-11 16:58:50.375232+00', NULL),
	('a9b22848-06ce-459a-a73b-520504271428', 'b62bd06c-5683-4ad1-b555-2d103c68a051', 'RBL', '2', '2026-04-12 00:47:00+00', 1.3721379025752611, 103.8246651312457, 'Grooming another individual.', '2026-04-11 16:47:43.484876+00', NULL),
	('8b4f1cad-407a-446d-9084-aed903486ce7', 'b62bd06c-5683-4ad1-b555-2d103c68a051', 'LTM', '3', '2026-04-12 00:47:00+00', 1.3731050366596946, 103.82474207615502, 'Sitting still and observing surroundings.', '2026-04-11 16:48:20.17636+00', NULL),
	('3cd460bc-d855-4417-a8a8-eac300f30460', '8882963f-9009-404a-9173-2edd4b123d94', 'RBL', '1', '2026-04-12 00:57:00+00', 0, 0, NULL, '2026-04-11 16:57:32.505356+00', NULL),
	('33d8ffb4-7f69-405b-9c23-7e59a6af326c', '7cdb514f-33c4-4495-8eab-fea6105e07a3', 'RBL', '1', '2026-04-14 15:17:00+00', 0, 0, NULL, '2026-04-14 07:18:03.912935+00', NULL),
	('acb9189f-3362-47a8-960f-d8ccae990b6b', '742cf8d3-f1d1-47fe-916d-b953a553e9ac', 'OTHER', '1', '2026-04-13 17:45:00+00', 1.3289049999520017, 103.82539404723985, 'hehe', '2026-04-13 09:46:00.264487+00', 'idk?'),
	('a778c3db-3eb4-4a5d-bf6c-91445d24116f', 'a5be2d4e-3542-4da7-a8c7-42c12b8208e2', 'RBL', '1', '2026-05-11 16:36:00+00', 0, 0, NULL, '2026-05-11 08:36:39.384645+00', NULL),
	('1362a901-ab45-489d-8eb8-c76b9d2fc216', '9c9009be-f0e2-47d1-b782-3c686387653c', 'RBL', '1', '2026-05-12 03:12:00+00', 1.3140646925828605, 103.79465697615962, 'mmmmmmm', '2026-05-11 19:12:47.989986+00', NULL);


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."media" ("id", "observation_id", "sighting_id", "file_path", "file_name", "media_type", "file_size", "exif_lat", "exif_lng", "exif_datetime", "created_at", "incident_id") VALUES
	('eaee8218-dce3-463a-9cb2-bbbef9e39b52', NULL, 'f9e4b880-8350-4afe-a574-a0deed411207', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/f9e4b880-8350-4afe-a574-a0deed411207/03136418-0c86-428f-8b08-62ac6b65822d.jpg', 'RBL1.jpg', 'PHOTO', 197500, NULL, NULL, '2020-01-19 08:10:00+00', '2026-04-11 16:39:43.62616+00', NULL),
	('8061f963-8f84-4ac7-b597-b444a5f36c1e', NULL, 'c1fe4d83-7349-441e-bedc-bdfeecd906bf', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/c1fe4d83-7349-441e-bedc-bdfeecd906bf/bf1aba9f-edaa-426c-b386-6c112fb047b4.jpg', 'LTM1.jpg', 'PHOTO', 175510, NULL, NULL, NULL, '2026-04-11 16:40:55.006543+00', NULL),
	('f6d7d430-2812-4ca3-862a-7eca121c6eee', NULL, '6ec52b58-c855-41ab-b44c-ec69bc2f2dee', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/6ec52b58-c855-41ab-b44c-ec69bc2f2dee/584d7eb0-997b-4fa4-8a8f-b69b671cf728.jpg', 'DUSKY1.jpg', 'PHOTO', 53564, NULL, NULL, NULL, '2026-04-11 16:41:35.818887+00', NULL),
	('3039c4d0-33a5-460d-be3e-ec7e0192b5d3', NULL, 'ee26ff4c-5523-4606-ad28-23385d31e916', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/ee26ff4c-5523-4606-ad28-23385d31e916/48e05753-1193-415b-bf67-fb29c2f4fa88.jpeg', 'SQUIRREL.jpeg', 'PHOTO', 128128, NULL, NULL, NULL, '2026-04-11 16:43:26.254351+00', NULL),
	('12e44470-cc19-4d42-b816-5fe227c7fe05', NULL, 'a9b22848-06ce-459a-a73b-520504271428', '56823340-0cb5-4679-aab3-8fa552178a90/a9b22848-06ce-459a-a73b-520504271428/58fa9d08-555f-4066-8f46-538b8147d10b.jpg', 'RBL2.jpg', 'PHOTO', 68269, NULL, NULL, NULL, '2026-04-11 16:48:15.877662+00', NULL),
	('714689c6-9574-46c9-98df-396379188c95', NULL, '8b4f1cad-407a-446d-9084-aed903486ce7', '56823340-0cb5-4679-aab3-8fa552178a90/8b4f1cad-407a-446d-9084-aed903486ce7/73ad2a98-f5a6-42e6-8110-55649318f2b5.jpg', 'LTM2.jpg', 'PHOTO', 47352, NULL, NULL, NULL, '2026-04-11 16:48:48.563308+00', NULL),
	('a8a3646e-5542-4dea-b1ea-9845bb27fdc2', NULL, '5b9bb001-6d44-4b01-9a38-ac8d480d0033', '56823340-0cb5-4679-aab3-8fa552178a90/5b9bb001-6d44-4b01-9a38-ac8d480d0033/4a398b5c-ccb0-4175-97e4-a23338437f06.jpg', 'DUSKY2.jpg', 'PHOTO', 53323, NULL, NULL, NULL, '2026-04-11 16:50:29.671055+00', NULL),
	('737b428b-1219-4d68-8d90-008302ad0f28', NULL, NULL, '888758d2-5bf0-4ecb-a85e-cc998ebe775b/97d45f21-9f57-4b9c-969d-19f52e879d78/d7769b11-bc93-4016-ac5f-52ce83620d24.jpeg', 'HABITAT_DAMAGE.jpeg', 'PHOTO', 16018, NULL, NULL, NULL, '2026-04-11 16:55:56.506356+00', '97d45f21-9f57-4b9c-969d-19f52e879d78'),
	('601e3982-fe4b-40f8-962a-24f6a7a0b5fb', NULL, '4b4c2ffc-e74b-4ce7-bc45-4a601ab8bc41', '71c422c5-ff93-495c-9f90-b8cf3e40d696/4b4c2ffc-e74b-4ce7-bc45-4a601ab8bc41/fda6d056-6868-4fd4-80e6-cbf4e1537b18.jpg', 'RBL1.jpg', 'PHOTO', 197500, NULL, NULL, '2020-01-19 08:10:00+00', '2026-04-11 16:58:44.553454+00', NULL),
	('2e933288-0c44-49af-b19a-fbdcbbbbbf47', NULL, '2ca59963-860e-4290-a21e-e994bbc21070', '71c422c5-ff93-495c-9f90-b8cf3e40d696/2ca59963-860e-4290-a21e-e994bbc21070/e142f274-76ef-4a6b-a44a-b8c1161c91ff.jpg', 'LTM1.jpg', 'PHOTO', 175510, NULL, NULL, NULL, '2026-04-11 16:59:20.998273+00', NULL),
	('ac9c2cbc-682b-434c-b7d3-8ca3e42e4b6c', NULL, 'd3aa93d8-a3e9-478b-afe5-fab9ff918692', 'cc60e20c-0986-4157-a153-1c62e0c76042/d3aa93d8-a3e9-478b-afe5-fab9ff918692/a5b2a619-ec7b-4d75-8b86-225c4b464dc7.jpg', 'RBL1.jpg', 'PHOTO', 197500, NULL, NULL, '2020-01-19 08:10:00+00', '2026-04-13 07:05:49.925516+00', NULL),
	('54bf0fde-2a93-43fc-bb89-f98a97034052', NULL, '9fd7dbf6-57e9-40d4-9a98-3a9b96b60a16', 'cc60e20c-0986-4157-a153-1c62e0c76042/9fd7dbf6-57e9-40d4-9a98-3a9b96b60a16/b560d498-f737-421f-a820-8653523276c2.jpg', 'RBL1.jpg', 'PHOTO', 197500, NULL, NULL, '2020-01-19 08:10:00+00', '2026-04-13 07:17:36.69894+00', NULL),
	('4b58dc3b-a7f6-4986-89de-720171953d6b', NULL, 'acb9189f-3362-47a8-960f-d8ccae990b6b', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/acb9189f-3362-47a8-960f-d8ccae990b6b/d5c9a906-d3d3-45ba-a9d5-efafe5bab2c8.jpeg', 'IMG_1417 (1).jpeg', 'PHOTO', 2932345, 35.68848333333333, 128.46624722222222, '2025-10-10 13:11:00+00', '2026-04-13 09:46:13.308992+00', NULL),
	('1749d252-2e0e-40af-9337-40cee81d29e0', NULL, '1362a901-ab45-489d-8eb8-c76b9d2fc216', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/1362a901-ab45-489d-8eb8-c76b9d2fc216/22903832-80af-40dd-a132-d0267924e2ef.png', 'Screenshot_1778027179.png', 'PHOTO', 260754, NULL, NULL, NULL, '2026-05-11 19:13:06.685924+00', NULL);


--
-- Data for Name: round_participation_requirements; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."round_participation_requirements" ("id", "user_id", "round_id", "indemnity_acknowledged_at", "guardian_name", "guardian_email", "guardian_email_verified_at", "guardian_phone_number", "guardian_phone_verified_at", "created_at", "updated_at") VALUES
	('d178629a-a4bf-4fe4-afcd-03d0ad69f92a', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'd0fcd1da-8664-4d11-b660-317be7479c8f', '2026-07-08 06:29:18.275+00', 'nky', 'ngkhengyang@gmail.com', '2026-07-08 06:28:57.36+00', '+6597868371', '2026-07-08 06:29:09.292+00', '2026-07-07 15:44:58.616434+00', '2026-07-08 06:29:18.275+00');


--
-- Data for Name: slot_memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."slot_memberships" ("id", "slot_id", "user_id", "status", "joined_at", "cancelled_at") VALUES
	('a8e8f432-f1ec-45a0-ae75-99198de5c8d9', '67900344-3562-4e0e-8abe-559355e9e3cb', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-04-11 16:23:57.048437+00', NULL),
	('eee8a362-05c7-480b-960e-3df7a2fd6547', '709d6317-26f6-4a95-b410-9eda24ef1820', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-04-11 16:24:02.484824+00', NULL),
	('a026e4a9-afe0-4dbb-8324-511d91cd50d3', 'cd36b3b3-d954-44c5-8811-4e86f5a5eb36', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-04-11 16:24:09.540185+00', NULL),
	('141f4364-5c8e-4a01-a9fc-e42cd2142362', '709d6317-26f6-4a95-b410-9eda24ef1820', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'ACTIVE', '2026-04-11 16:31:50.057228+00', NULL),
	('fa71ab5d-dc81-4934-9dde-f7fdfe152b29', '67900344-3562-4e0e-8abe-559355e9e3cb', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'CANCELLED', '2026-04-11 16:31:57.61677+00', '2026-04-11 16:32:06.631+00'),
	('017d3c38-4d0a-4d03-9e0f-35a22b70b9aa', '709d6317-26f6-4a95-b410-9eda24ef1820', '56823340-0cb5-4679-aab3-8fa552178a90', 'ACTIVE', '2026-04-11 16:34:26.098825+00', NULL),
	('000c9e6e-2c86-4dca-a787-14cf35487e92', '52ee3a01-2577-47bb-8136-8c8f4ccfde07', '56823340-0cb5-4679-aab3-8fa552178a90', 'ACTIVE', '2026-04-11 16:34:36.132308+00', NULL),
	('0f4f2d55-f60a-4a4a-86e5-ab36e5c970ba', '33104d62-71a1-4a28-ae5a-a98352fcf80d', 'ef71f1fa-d448-4c9f-9b10-76a559bb8069', 'ACTIVE', '2026-04-11 16:35:06.283073+00', NULL),
	('16dd6728-d1bc-462b-905d-f24e14b162e4', '67900344-3562-4e0e-8abe-559355e9e3cb', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'ACTIVE', '2026-04-11 16:57:09.358781+00', NULL),
	('27dde32f-c73b-454d-b150-9d15e5f14cc8', 'cd36b3b3-d954-44c5-8811-4e86f5a5eb36', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'ACTIVE', '2026-04-11 16:57:53.828681+00', NULL),
	('d8cd0997-0071-4197-925f-a2c17a06f13b', 'cd36b3b3-d954-44c5-8811-4e86f5a5eb36', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'ACTIVE', '2026-04-13 07:04:18.837149+00', NULL),
	('23e4a528-6a68-4425-87cb-69bff15fd79d', '3a78fc15-9661-42f7-82ad-44f61b3c64f9', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'ACTIVE', '2026-04-13 07:15:05.456419+00', NULL),
	('39ea420e-1c12-481d-8a34-5f48f047c3a6', '3a78fc15-9661-42f7-82ad-44f61b3c64f9', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', 'ACTIVE', '2026-04-13 09:44:14.990859+00', NULL),
	('4e79773d-474d-45e5-89b7-96e3f980ec40', '3a78fc15-9661-42f7-82ad-44f61b3c64f9', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-04-14 05:59:40.143423+00', NULL),
	('96e55fd5-7e22-4c0a-b425-e20aeba23bf9', '846c0897-3abd-4ef8-8f2d-8dcba3622731', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-05-11 06:51:08.187553+00', NULL),
	('5ee2e3d7-4506-44cd-9f54-cae46a77b622', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-05-11 06:54:17.44794+00', NULL),
	('b3329076-62de-4e19-974e-b2290d9dfa21', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', '51b1cf99-e8c3-4c9a-8143-6be06b6dba70', 'ACTIVE', '2026-05-11 07:18:42.8064+00', NULL),
	('7c88a1d2-1339-40c2-a185-a93438dae0e0', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', 'ACTIVE', '2026-05-11 08:36:13.248131+00', NULL),
	('179d9687-41f8-47ad-8ea0-d0f08ddb8780', 'c20018e4-0221-4beb-b396-c26ea28ca7e8', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', 'ACTIVE', '2026-05-11 19:07:00.754798+00', NULL),
	('a9f19672-5aec-4533-8868-0927085be932', '2efad287-4719-42e6-8d18-723641afb728', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'CANCELLED', '2026-05-28 10:32:03.518817+00', '2026-05-28 10:32:34.63186+00'),
	('9c0eb874-6de2-40ea-b3e5-d2bdd9428bcc', '5e7b7335-36aa-40ff-9f18-15a62e16b617', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-06-10 08:35:50.825821+00', NULL),
	('8d866d80-1f89-4914-bd76-1ea376bc9d1e', '0b6f4eda-a939-4e38-b1b8-7a98081c8a7f', '4406c55b-09b6-4f82-8975-6bffe8886513', 'ACTIVE', '2026-06-24 06:15:05.42867+00', NULL),
	('5ee531c8-a529-443f-96db-ca4f88a138eb', 'bbdbe4b5-62e5-4b91-9225-adb359a98037', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'CANCELLED', '2026-06-24 09:41:58.281722+00', '2026-06-24 09:42:05.926986+00'),
	('690b44e3-42f5-4fff-9561-df1162ebc84a', 'bbdbe4b5-62e5-4b91-9225-adb359a98037', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'ACTIVE', '2026-06-24 09:54:34.297777+00', NULL),
	('3c0e1a46-1a22-4cde-ad79-c74cac17749f', '6f6bf323-9a62-4a4a-81db-dab64b5eb13a', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'ACTIVE', '2026-06-24 10:06:51.75245+00', NULL),
	('d6499ef1-4e99-4f6c-a924-3725a52723f1', '756de038-6ea5-4455-893c-64e139a5478e', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'ACTIVE', '2026-06-24 10:09:02.097505+00', NULL),
	('84f6844d-aa42-45c8-afe9-cd3294d84fb6', 'd1c7caad-af1d-40b6-8fa6-2b528ca8ad8c', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'ACTIVE', '2026-06-24 10:23:42.770205+00', NULL),
	('75e516c5-6358-429b-9c4a-b1435e271244', '6f6bf323-9a62-4a4a-81db-dab64b5eb13a', '4406c55b-09b6-4f82-8975-6bffe8886513', 'ACTIVE', '2026-06-26 05:33:04.376116+00', NULL),
	('633213bb-e3c3-4aea-9ecb-9a8b704b2cbd', '756de038-6ea5-4455-893c-64e139a5478e', '4406c55b-09b6-4f82-8975-6bffe8886513', 'ACTIVE', '2026-06-26 05:33:23.291194+00', NULL),
	('e202ea65-d415-4d68-bc1a-c77c08d7e28a', '2863ff2d-3fca-45a6-915f-a2716fdc31ae', '4406c55b-09b6-4f82-8975-6bffe8886513', 'ACTIVE', '2026-06-28 05:17:06.374419+00', NULL),
	('6fd73061-fa82-4193-9b03-305764c8bc3e', 'cefc8f26-fed3-42f9-80bd-1ef79c039bc4', '4406c55b-09b6-4f82-8975-6bffe8886513', 'ACTIVE', '2026-06-28 05:17:16.771729+00', NULL),
	('56ebb9ce-e207-405d-ba2d-84b7e15a8d7f', '00d58acd-f74d-4e62-b658-b51b772b1195', '4406c55b-09b6-4f82-8975-6bffe8886513', 'ACTIVE', '2026-06-28 05:19:14.839549+00', NULL),
	('2c756b71-216d-41b9-ad06-1ae62d2bd1c3', '2863ff2d-3fca-45a6-915f-a2716fdc31ae', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-06-28 06:46:43.367668+00', NULL),
	('48c63be4-191b-45a2-bbd3-c8435222104c', '00d58acd-f74d-4e62-b658-b51b772b1195', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', 'ACTIVE', '2026-06-28 06:46:56.930804+00', NULL),
	('8680b8f9-15ac-49c0-bb3e-ca3f6cfda0e7', '2863ff2d-3fca-45a6-915f-a2716fdc31ae', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'ACTIVE', '2026-06-28 06:47:21.810591+00', NULL),
	('6fa8789e-8f54-4ea9-bdad-627871560745', 'bbdbe4b5-62e5-4b91-9225-adb359a98037', 'cc60e20c-0986-4157-a153-1c62e0c76042', 'ACTIVE', '2026-06-28 06:47:40.773678+00', NULL),
	('c5d43c47-ebce-4b33-8d2c-d342e10cf059', '00d58acd-f74d-4e62-b658-b51b772b1195', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'ACTIVE', '2026-06-28 06:50:48.049076+00', NULL),
	('25d36773-12b7-41a9-9775-2b59c1c8e312', '825278bd-5d21-4027-bc47-68db6e4341a6', '71c422c5-ff93-495c-9f90-b8cf3e40d696', 'ACTIVE', '2026-06-28 06:50:56.312497+00', NULL),
	('b785247c-d90a-4fe2-b4a5-e47b401574a6', '9a9ad23f-06ad-4097-a37e-70ada94b51f1', '4406c55b-09b6-4f82-8975-6bffe8886513', 'ACTIVE', '2026-07-15 11:15:36.30917+00', NULL),
	('5aad4ef9-0d6d-4db6-b095-f4581b3a8b89', '9a9ad23f-06ad-4097-a37e-70ada94b51f1', '9a790d9b-71fc-4926-8135-4c8ddea1ec40', 'ACTIVE', '2026-07-15 11:16:06.791317+00', NULL);


--
-- Data for Name: user_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_audit_logs" ("id", "user_id", "actor_id", "event_type", "reason", "slot_id", "round_id", "metadata", "occurred_at", "created_at") VALUES
	('9f4f43db-9010-48a2-b473-9e6666932b2e', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'LATE_WALK_CANCELLATION', 'Cannot make it, me me sickkkk :(', '2efad287-4719-42e6-8d18-723641afb728', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', '{"walk_date": "2026-05-28", "start_time": "21:00:00", "location_name": "Thomson Nature Park", "late_cancel_hours": 24}', '2026-05-28 10:16:03.622717+00', '2026-05-28 10:16:03.622717+00'),
	('d92b2354-b7f3-4ae9-88a9-6be6194e3fa3', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'LATE_WALK_CANCELLATION', 'Sorry! I''m feeling under the weather tdy :(', '2efad287-4719-42e6-8d18-723641afb728', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', '{"walk_date": "2026-05-28", "start_time": "21:00:00", "location_name": "Thomson Nature Park", "late_cancel_hours": 24}', '2026-05-28 10:32:34.63186+00', '2026-05-28 10:32:34.63186+00'),
	('938fd31d-ccc4-4389-a2ea-b3b39f277700', '4406c55b-09b6-4f82-8975-6bffe8886513', '4406c55b-09b6-4f82-8975-6bffe8886513', 'LATE_WALK_CANCELLATION', 'Fell sick', NULL, '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', '{"walk_date": "2026-06-24", "start_time": "18:00:00", "location_name": "Thomson Nature Park", "late_cancel_hours": 24}', '2026-06-23 20:00:55.940746+00', '2026-06-23 20:00:55.940746+00'),
	('afece9f4-a469-4fa3-ac69-8f41d59bdb78', '4406c55b-09b6-4f82-8975-6bffe8886513', '4406c55b-09b6-4f82-8975-6bffe8886513', 'LATE_WALK_CANCELLATION', 'MC', NULL, '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', '{"walk_date": "2026-06-24", "start_time": "18:00:00", "location_name": "Thomson Nature Park", "late_cancel_hours": 24}', '2026-06-24 05:25:05.783017+00', '2026-06-24 05:25:05.783017+00'),
	('b478dbc2-33ae-4a63-bd43-010c972017e3', '4406c55b-09b6-4f82-8975-6bffe8886513', '4406c55b-09b6-4f82-8975-6bffe8886513', 'LATE_WALK_CANCELLATION', 'MC2', NULL, '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', '{"walk_date": "2026-06-24", "start_time": "18:00:00", "location_name": "Thomson Nature Park", "late_cancel_hours": 24}', '2026-06-24 05:28:29.644607+00', '2026-06-24 05:28:29.644607+00'),
	('d893aa97-9d90-41d2-9bb6-756e3f27d23a', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'ed8835fa-ab3a-4078-89e7-f660e08f02bf', 'LATE_WALK_CANCELLATION', 'Testing my luckkk :(', 'bbdbe4b5-62e5-4b91-9225-adb359a98037', '72abb00f-ac9a-41f1-85a9-18ebcb5f96f3', '{"walk_date": "2026-06-28", "start_time": "15:00:00", "location_name": "Windsor Nature Park", "reminder_sent_at": "2026-06-24T09:44:39.046+00:00"}', '2026-06-24 09:49:16.507088+00', '2026-06-24 09:49:16.507088+00');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") VALUES
	('ac55d0e6-f2ac-4f00-9db9-32a7806c8b1c', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/14486936-bc34-477f-a128-980e77464c21/51263c28-d71b-46a9-9569-feff7a064d66.png', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-02-21 12:22:26.214315+00', '2026-02-21 12:22:26.214315+00', '2026-02-21 12:22:26.214315+00', '{"eTag": "\"891ef58d5f88982ee20da1a8d85c32b6\"", "size": 572312, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-02-21T12:22:27.000Z", "contentLength": 572312, "httpStatusCode": 200}', 'd98a611e-67a7-4218-9857-32643e6153cf', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('fdd6a57d-f4cc-4ff7-ab47-08a19236cb10', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/14486936-bc34-477f-a128-980e77464c21/9a226b92-f6a6-461c-bf85-6c5ab027142e.png', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-02-21 12:25:15.035845+00', '2026-02-21 12:25:15.035845+00', '2026-02-21 12:25:15.035845+00', '{"eTag": "\"c1dd0a04b3bf3778ecfa21003231b15d\"", "size": 110465, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-02-21T12:25:16.000Z", "contentLength": 110465, "httpStatusCode": 200}', 'd2f5825b-138f-454f-ac0f-e321c09adac8', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('1e9b740f-d0aa-491b-a7ff-f5ccf4f42cc7', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/7d6a94e6-4b81-43eb-bc84-a926b6c7b7af/89526566-c03d-483b-825b-ab1cd09d51b0.jpg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-03-22 13:16:52.487764+00', '2026-03-22 13:16:52.487764+00', '2026-03-22 13:16:52.487764+00', '{"eTag": "\"2fd76123646a80f3274ed043cbd86f0c\"", "size": 66853, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-22T13:16:53.000Z", "contentLength": 66853, "httpStatusCode": 200}', '14b54b1d-73af-40d3-ad4f-d93ced2c291d', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('37611586-e22e-4c7a-806f-6027ded7e009', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/fd4664f2-c7b9-4395-a4c5-34efab420757/9e77b046-fffd-49b1-bcb0-e36cc610ecf6.jpg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-03-24 15:28:34.76352+00', '2026-03-24 15:28:34.76352+00', '2026-03-24 15:28:34.76352+00', '{"eTag": "\"2fd76123646a80f3274ed043cbd86f0c\"", "size": 66853, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-24T15:28:35.000Z", "contentLength": 66853, "httpStatusCode": 200}', 'fdbf44e0-c4f7-4da5-99a8-a88b584b1ad2', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('1e85ac7e-8d43-4d2f-b039-69134879c547', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/84c5979f-b539-4d2a-8026-17c6ff59b981/733e6292-d476-49c7-8c45-13255854b941.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 19:44:46.404894+00', '2026-03-25 19:44:46.404894+00', '2026-03-25 19:44:46.404894+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T19:44:47.000Z", "contentLength": 842446, "httpStatusCode": 200}', '147d9439-a5d2-4579-a219-98860cb002b4', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('41865e95-3a08-4e4d-a73c-47dbbf1cec1e', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/84c5979f-b539-4d2a-8026-17c6ff59b981/60884290-221b-4b72-bc71-d6e7ddff43d4.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 19:48:43.601151+00', '2026-03-25 19:48:43.601151+00', '2026-03-25 19:48:43.601151+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T19:48:44.000Z", "contentLength": 842446, "httpStatusCode": 200}', '24100c39-3e69-4bac-9701-146c92d386a3', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('004af9b2-0f44-4d26-8ecf-9a5a81847615', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/0074707b-873c-4d2a-a97c-b12a190673c9/7abd95c8-a163-483d-b57c-aa6e3b4a0520.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 19:48:44.39252+00', '2026-03-25 19:48:44.39252+00', '2026-03-25 19:48:44.39252+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T19:48:45.000Z", "contentLength": 842446, "httpStatusCode": 200}', '96dd9369-0508-4705-8049-ef2bbe24f571', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('9dbd31f8-2d93-47b6-8e56-68edc3690572', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/84c5979f-b539-4d2a-8026-17c6ff59b981/ae4704a9-31b2-4c5b-9cc5-121b14b1e7fa.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 19:50:45.569505+00', '2026-03-25 19:50:45.569505+00', '2026-03-25 19:50:45.569505+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T19:50:46.000Z", "contentLength": 842446, "httpStatusCode": 200}', 'a35b8035-1d82-4bba-83aa-d2231f3d953a', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('a477fa5b-a368-48d1-ab6b-2c0930df13a9', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/0074707b-873c-4d2a-a97c-b12a190673c9/7393913e-da0b-4655-bfae-501a6d37a43f.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 19:50:46.499503+00', '2026-03-25 19:50:46.499503+00', '2026-03-25 19:50:46.499503+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T19:50:47.000Z", "contentLength": 842446, "httpStatusCode": 200}', 'af3df7eb-aae4-4329-bed2-151ea5dbbe2d', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('35327d82-5434-4512-9c1f-0c11097d5f56', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/84c5979f-b539-4d2a-8026-17c6ff59b981/71b98de6-21ce-4ec9-b082-cd810c25b0af.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 19:59:59.093954+00', '2026-03-25 19:59:59.093954+00', '2026-03-25 19:59:59.093954+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:00:00.000Z", "contentLength": 842446, "httpStatusCode": 200}', 'f2191f4c-fac2-4e58-9783-354bab82841a', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('eb7b1d49-424c-4a14-a673-65b65c9e4d48', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/0074707b-873c-4d2a-a97c-b12a190673c9/a701cd09-f4fe-4185-b429-8c541bb27159.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 20:00:00.143042+00', '2026-03-25 20:00:00.143042+00', '2026-03-25 20:00:00.143042+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:00:01.000Z", "contentLength": 842446, "httpStatusCode": 200}', '3c6f77f3-0fc3-4f2d-a33c-fe08fb6b60f3', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('a9473c43-263f-4c20-ba1e-3b56e2077a86', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/84c5979f-b539-4d2a-8026-17c6ff59b981/7de3cd6e-ca2f-4cbe-bbc7-6523dbb9120d.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 20:00:47.369429+00', '2026-03-25 20:00:47.369429+00', '2026-03-25 20:00:47.369429+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:00:48.000Z", "contentLength": 842446, "httpStatusCode": 200}', 'd7e4a4d8-8e37-4d2f-9d5c-247416f36ee6', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('4e1edf19-991a-477f-a8fa-d551e4eb3a46', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/0074707b-873c-4d2a-a97c-b12a190673c9/b225cd3a-edcf-423e-83d7-77eb377f87bb.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 20:00:48.154702+00', '2026-03-25 20:00:48.154702+00', '2026-03-25 20:00:48.154702+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:00:49.000Z", "contentLength": 842446, "httpStatusCode": 200}', 'fd585001-d6df-4f1a-aed7-008752a3673f', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('ab83e1e9-a236-4c6d-a889-3fd76fce60b0', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/05025038-a284-4bce-b891-6ff3a29f25ce/2f1d9ba0-dcbe-4afc-b7f8-276fdf9dcf8f.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 20:00:48.916833+00', '2026-03-25 20:00:48.916833+00', '2026-03-25 20:00:48.916833+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:00:49.000Z", "contentLength": 842446, "httpStatusCode": 200}', '97afbe39-0379-4b17-935c-d6163b988eee', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('3a203aae-e90f-41c6-8286-592a14720d49', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/54493dbf-e52a-426f-b40d-e2f2ae6b53a6/789fc0db-43c1-464c-ad5d-140ec102dcf7.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 20:03:54.572443+00', '2026-03-25 20:03:54.572443+00', '2026-03-25 20:03:54.572443+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:03:55.000Z", "contentLength": 842446, "httpStatusCode": 200}', '14c9ac58-18ec-44bb-8b89-02721592b856', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('c47a038d-fae2-4640-bdb7-a0fd180fcccc', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/8562011f-18c5-4db5-9086-24db1e17738a/b33e74af-4e73-4209-9a40-87399a946d7f.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 20:14:01.719871+00', '2026-03-25 20:14:01.719871+00', '2026-03-25 20:14:01.719871+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:14:02.000Z", "contentLength": 842446, "httpStatusCode": 200}', 'be57b2a1-3d30-47c0-b608-6ee76ccba872', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('c6a83a94-406e-43a6-9c9d-492725d4cec0', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/8562011f-18c5-4db5-9086-24db1e17738a/531a1576-aa4e-47e6-ad9a-2b96a46fb57d.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-25 20:14:23.644925+00', '2026-03-25 20:14:23.644925+00', '2026-03-25 20:14:23.644925+00', '{"eTag": "\"4d0d316b25a7d367381cee181736e88d\"", "size": 842446, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-25T20:14:24.000Z", "contentLength": 842446, "httpStatusCode": 200}', 'f99faa38-d6ca-415e-a850-17b3b86f93c0', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('7689607a-867e-4429-b724-a8ce7237256a', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/d50afd03-0b40-4e41-8a0e-6bdde7d006c8/05205eb0-5048-4629-a6a9-5b684b983e18.png', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-03-26 03:18:20.023297+00', '2026-03-26 03:18:20.023297+00', '2026-03-26 03:18:20.023297+00', '{"eTag": "\"7817a5fcc3a692e4d57e12649c744e07\"", "size": 106394, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-03-26T03:18:20.000Z", "contentLength": 106394, "httpStatusCode": 200}', '1c62abcf-3d73-4228-a6da-70fc3248ff09', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('8b821cac-3631-44e8-ad89-d317a8b5e8fd', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/9a57e398-dc6f-4ce1-a6c2-8d6ea8c13d68/6a6e77c1-5e4b-4888-8b88-1faf314b2e46.jpg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-03-26 12:49:10.485677+00', '2026-03-26 12:49:10.485677+00', '2026-03-26 12:49:10.485677+00', '{"eTag": "\"2fd76123646a80f3274ed043cbd86f0c\"", "size": 66853, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-26T12:49:11.000Z", "contentLength": 66853, "httpStatusCode": 200}', '79d0e8c7-9609-42a7-85ac-fea76a8f7a2d', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('22cb1c38-3a6a-4717-93bd-9195b0902aa6', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/9a57e398-dc6f-4ce1-a6c2-8d6ea8c13d68/71181d57-43e8-424d-99cf-22044fb9c31c.jpeg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-03-26 12:49:12.973512+00', '2026-03-26 12:49:12.973512+00', '2026-03-26 12:49:12.973512+00', '{"eTag": "\"e766d234e17e30a27c2e2cd3b70668d2\"", "size": 664872, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-26T12:49:13.000Z", "contentLength": 664872, "httpStatusCode": 200}', '982b6300-3434-4de6-93e2-33f01d4dbde1', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('67664f71-a497-4af0-af3d-d8f583c472b6', 'observation-media', 'b1461fb1-f3f9-4237-94e5-6f6640ea83d2/ae68f922-29f4-423b-837b-79ff725687c8/c035f199-a723-456a-8978-b5c5da0fec9e.png', 'b1461fb1-f3f9-4237-94e5-6f6640ea83d2', '2026-03-26 18:07:47.089794+00', '2026-03-26 18:07:47.089794+00', '2026-03-26 18:07:47.089794+00', '{"eTag": "\"8964a2363b2c61a4b2d2cac6ed1f8ac1\"", "size": 1900, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-03-26T18:07:48.000Z", "contentLength": 1900, "httpStatusCode": 200}', '53de222b-aa0b-41a8-9be3-852b8ae1df1a', 'b1461fb1-f3f9-4237-94e5-6f6640ea83d2', '{}'),
	('531ddaaa-4350-419c-8307-167d42957e76', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/652de072-8a71-49a5-91eb-6b579a35af0f/46838d67-7094-4374-94ce-b7ff19a7eba0.png', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-04-06 18:04:33.374691+00', '2026-04-06 18:04:33.374691+00', '2026-04-06 18:04:33.374691+00', '{"eTag": "\"5f59b61365b25f82db16e58f09e4a83c\"", "size": 56852, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-04-06T18:04:34.000Z", "contentLength": 56852, "httpStatusCode": 200}', '462c6dd9-9c5b-499f-ade1-9975a2e7e255', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('d38e919d-6e68-44f5-ad77-4ec076b057e4', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/652de072-8a71-49a5-91eb-6b579a35af0f/4fef3b97-dcb2-4cf2-8c15-3a0bbb76c0de.png', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-04-06 18:04:34.365241+00', '2026-04-06 18:04:34.365241+00', '2026-04-06 18:04:34.365241+00', '{"eTag": "\"2647d9e7db6299168d9c8e0f12b6016e\"", "size": 283304, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-04-06T18:04:35.000Z", "contentLength": 283304, "httpStatusCode": 200}', 'f8299695-d33c-4ee1-9641-e3c4630340e9', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('676f7a87-c847-4dc1-832c-a2a82725c5dc', 'observation-media', 'b1461fb1-f3f9-4237-94e5-6f6640ea83d2/506ef025-8391-4783-8f9f-bdee22edd6bb/02ff81c6-a210-49cd-a2c8-237b6ddc1430.png', 'b1461fb1-f3f9-4237-94e5-6f6640ea83d2', '2026-03-26 18:30:17.264367+00', '2026-03-26 18:30:17.264367+00', '2026-03-26 18:30:17.264367+00', '{"eTag": "\"8964a2363b2c61a4b2d2cac6ed1f8ac1\"", "size": 1900, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-03-26T18:30:18.000Z", "contentLength": 1900, "httpStatusCode": 200}', '9a407cba-1c9c-4e51-9138-d7cf4e663617', 'b1461fb1-f3f9-4237-94e5-6f6640ea83d2', '{}'),
	('7001726c-2a6f-4a5b-9405-d3ac69dedb6d', 'observation-media', 'ec26112d-5f65-4666-9d40-5fb222f55dbf/d007189d-fcae-4bd4-a988-e9fa424ca05b/e822d433-800a-40d0-9330-82b7caec5980.jpg', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '2026-03-27 03:37:03.747523+00', '2026-03-27 03:37:03.747523+00', '2026-03-27 03:37:03.747523+00', '{"eTag": "\"7097a245288a397b00852f09d26f13d7\"", "size": 148608, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-27T03:37:04.000Z", "contentLength": 148608, "httpStatusCode": 200}', '28e6affd-50cd-441e-83c5-4bf060e47fe5', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '{}'),
	('60196524-50ac-4526-80b1-4ee383940b29', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/652de072-8a71-49a5-91eb-6b579a35af0f/eabd38ea-c619-4bca-a00a-3671b97beff2.jpg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-04-06 18:07:03.886955+00', '2026-04-06 18:07:03.886955+00', '2026-04-06 18:07:03.886955+00', '{"eTag": "\"a03638cb71d32ff5b756b384f554368b\"", "size": 146946, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-06T18:07:04.000Z", "contentLength": 146946, "httpStatusCode": 200}', 'd9f66e60-b457-4c71-a19e-7bc6d7a8630a', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('cd02b69d-f699-4df5-a813-2f52f261c570', 'observation-media', 'ec26112d-5f65-4666-9d40-5fb222f55dbf/ff04134e-c14b-4e64-9e8c-be063b5067b8/6df8e136-3050-4847-a179-a0fe6c04b3b9.jpg', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '2026-03-27 03:37:04.702714+00', '2026-03-27 03:37:04.702714+00', '2026-03-27 03:37:04.702714+00', '{"eTag": "\"7097a245288a397b00852f09d26f13d7\"", "size": 148608, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-03-27T03:37:05.000Z", "contentLength": 148608, "httpStatusCode": 200}', 'f8a8f6b0-d1b8-42e6-b428-a01dd977b01e', 'ec26112d-5f65-4666-9d40-5fb222f55dbf', '{}'),
	('ba29427d-d6e4-4c79-b92f-f815cc92c96e', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/90d9f9eb-ef7d-4c73-976e-877c616c289c/f9595a16-39ef-42b7-b81e-a7d5f104aaa9.jpeg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-04-02 08:19:25.176805+00', '2026-04-02 08:19:25.176805+00', '2026-04-02 08:19:25.176805+00', '{"eTag": "\"f130e277598f707223b0f52f4a37b12b\"", "size": 2943022, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-02T08:19:26.000Z", "contentLength": 2943022, "httpStatusCode": 200}', '24926482-c9e2-4929-8e62-339dc691cd73', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('99595700-7eb3-4471-acaa-54aa9a7d648e', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/b3465103-7045-4d3a-9061-73915d504c88/498591d5-da92-418c-8f4d-3b36fa4ba69b.png', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-04-02 08:21:40.966209+00', '2026-04-02 08:21:40.966209+00', '2026-04-02 08:21:40.966209+00', '{"eTag": "\"ca593cadd6a79e4db021cd0ac6ad9529\"", "size": 267974, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-04-02T08:21:41.000Z", "contentLength": 267974, "httpStatusCode": 200}', '5f5e64f9-a5a3-41cc-b203-9861c6bc5131', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('dc854b7c-3d8e-45e2-a661-1191a19d25d7', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/57410ed5-fa8d-4557-a612-9a8111c7e8f1/0779f0e9-9d51-419b-91c7-155c5a21da38.jpg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-04-07 13:04:29.093745+00', '2026-04-07 13:04:29.093745+00', '2026-04-07 13:04:29.093745+00', '{"eTag": "\"2fd76123646a80f3274ed043cbd86f0c\"", "size": 66853, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-07T13:04:30.000Z", "contentLength": 66853, "httpStatusCode": 200}', '1da461b0-65ef-4a2e-b3de-f35a8a4d63bd', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('6dfa475e-a81b-44e3-901f-2aa427b76c4b', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/57410ed5-fa8d-4557-a612-9a8111c7e8f1/7634f118-7505-46f6-90e9-2c06cd81bf15.jpg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-04-07 13:04:31.299618+00', '2026-04-07 13:04:31.299618+00', '2026-04-07 13:04:31.299618+00', '{"eTag": "\"2fd76123646a80f3274ed043cbd86f0c\"", "size": 66853, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-07T13:04:32.000Z", "contentLength": 66853, "httpStatusCode": 200}', '0a206aba-7646-46d9-873c-ec31cf261956', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('5d05407c-1783-45a1-b563-b664e7f39be0', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/57410ed5-fa8d-4557-a612-9a8111c7e8f1/02e6e634-d2f8-40d2-95e8-7ae835cc7b2f.jpg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-04-07 13:04:33.859035+00', '2026-04-07 13:04:33.859035+00', '2026-04-07 13:04:33.859035+00', '{"eTag": "\"2fd76123646a80f3274ed043cbd86f0c\"", "size": 66853, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-07T13:04:34.000Z", "contentLength": 66853, "httpStatusCode": 200}', 'b099f020-aede-4df4-84ed-ca429538b67f', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('aea726a7-49b6-490e-9f90-ae9c56dd8fc8', 'observation-media', '1b2bb982-0086-4a6a-aef8-8b2227490f64/57410ed5-fa8d-4557-a612-9a8111c7e8f1/5520c716-db62-425a-91ff-0c1fa4dbb746.jpg', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '2026-04-07 13:04:36.420712+00', '2026-04-07 13:04:36.420712+00', '2026-04-07 13:04:36.420712+00', '{"eTag": "\"2fd76123646a80f3274ed043cbd86f0c\"", "size": 66853, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-07T13:04:37.000Z", "contentLength": 66853, "httpStatusCode": 200}', 'b04fec03-035c-4030-84d0-9dbb72c41be3', '1b2bb982-0086-4a6a-aef8-8b2227490f64', '{}'),
	('da42abba-d7e7-42cb-ad73-98275678fc94', 'observation-media', '0248644a-1206-4888-8289-7a0df5789d2c/9c656278-7337-4c7c-8e17-0872b91ca5b1/fd1d5d61-44ae-4489-8c9a-1a8487a6d6a0.jpg', '0248644a-1206-4888-8289-7a0df5789d2c', '2026-04-09 10:27:10.328659+00', '2026-04-09 10:27:10.328659+00', '2026-04-09 10:27:10.328659+00', '{"eTag": "\"7ddec156f3ec6a269aad6ebfb58c8897\"", "size": 197500, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-09T10:27:11.000Z", "contentLength": 197500, "httpStatusCode": 200}', 'b41b0d7c-666b-4574-a325-1fa65e54ff20', '0248644a-1206-4888-8289-7a0df5789d2c', '{}'),
	('93fe5b29-a59d-4add-b502-369ec2b160c9', 'observation-media', 'c5c9bc81-3ff2-402c-a711-8a3789c25c93/f230fdbd-1ea9-4f5f-954e-ed94db7e1404/339fa1b8-5915-469f-8d0b-401136affae5.jpg', 'c5c9bc81-3ff2-402c-a711-8a3789c25c93', '2026-04-10 17:07:34.171974+00', '2026-04-10 17:07:34.171974+00', '2026-04-10 17:07:34.171974+00', '{"eTag": "\"7ddec156f3ec6a269aad6ebfb58c8897\"", "size": 197500, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-10T17:07:35.000Z", "contentLength": 197500, "httpStatusCode": 200}', '25cecb4c-a388-4dc8-8832-f7c8ebb49b5c', 'c5c9bc81-3ff2-402c-a711-8a3789c25c93', '{}'),
	('7f45f7fc-f89a-4266-a987-99c99fb01b9c', 'observation-media', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/f9e4b880-8350-4afe-a574-a0deed411207/03136418-0c86-428f-8b08-62ac6b65822d.jpg', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '2026-04-11 16:39:43.502329+00', '2026-04-11 16:39:43.502329+00', '2026-04-11 16:39:43.502329+00', '{"eTag": "\"7ddec156f3ec6a269aad6ebfb58c8897\"", "size": 197500, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:39:44.000Z", "contentLength": 197500, "httpStatusCode": 200}', 'e9a9c7ab-5fd5-4226-b010-6e98f3b121cf', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '{}'),
	('09d08e03-3b9d-46f8-99e9-d58e39f51397', 'observation-media', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/c1fe4d83-7349-441e-bedc-bdfeecd906bf/bf1aba9f-edaa-426c-b386-6c112fb047b4.jpg', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '2026-04-11 16:40:54.859718+00', '2026-04-11 16:40:54.859718+00', '2026-04-11 16:40:54.859718+00', '{"eTag": "\"5f47ee05073817ddc99adff3c84c563c\"", "size": 175510, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:40:55.000Z", "contentLength": 175510, "httpStatusCode": 200}', '49722adb-a450-487a-ad0b-db7a71dce5d6', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '{}'),
	('1e5e9e35-7f77-4394-a6e4-678fda5364e0', 'observation-media', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/6ec52b58-c855-41ab-b44c-ec69bc2f2dee/584d7eb0-997b-4fa4-8a8f-b69b671cf728.jpg', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '2026-04-11 16:41:35.658843+00', '2026-04-11 16:41:35.658843+00', '2026-04-11 16:41:35.658843+00', '{"eTag": "\"ce220532b4c4e76f0b81482dd3f0eced\"", "size": 53564, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:41:36.000Z", "contentLength": 53564, "httpStatusCode": 200}', '1ea38256-4296-4494-8fa8-697e05c9081d', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '{}'),
	('3a2fd36e-4ddc-44e3-a9c1-591dab70dd6c', 'observation-media', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/ee26ff4c-5523-4606-ad28-23385d31e916/48e05753-1193-415b-bf67-fb29c2f4fa88.jpeg', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '2026-04-11 16:43:26.116038+00', '2026-04-11 16:43:26.116038+00', '2026-04-11 16:43:26.116038+00', '{"eTag": "\"eb0755f52da8dbd3fb3a64b6db5c8dea\"", "size": 128128, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:43:27.000Z", "contentLength": 128128, "httpStatusCode": 200}', '0d79f8a5-a486-43f0-8a68-aa92604a176d', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '{}'),
	('5a2ff5cd-8676-4a6b-bcfd-9f28f2caf289', 'observation-media', '56823340-0cb5-4679-aab3-8fa552178a90/a9b22848-06ce-459a-a73b-520504271428/58fa9d08-555f-4066-8f46-538b8147d10b.jpg', '56823340-0cb5-4679-aab3-8fa552178a90', '2026-04-11 16:48:15.752709+00', '2026-04-11 16:48:15.752709+00', '2026-04-11 16:48:15.752709+00', '{"eTag": "\"c31151aef33dffbc580698e7614752ab\"", "size": 68269, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:48:16.000Z", "contentLength": 68269, "httpStatusCode": 200}', '53f70190-d626-4908-bd8d-3f376f82e781', '56823340-0cb5-4679-aab3-8fa552178a90', '{}'),
	('6976ff40-fe7c-45e9-8e0a-11340f1c25ef', 'observation-media', '56823340-0cb5-4679-aab3-8fa552178a90/8b4f1cad-407a-446d-9084-aed903486ce7/73ad2a98-f5a6-42e6-8110-55649318f2b5.jpg', '56823340-0cb5-4679-aab3-8fa552178a90', '2026-04-11 16:48:48.433489+00', '2026-04-11 16:48:48.433489+00', '2026-04-11 16:48:48.433489+00', '{"eTag": "\"2b5b3c9fe171e7e93bf31f9e464c1d40\"", "size": 47352, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:48:49.000Z", "contentLength": 47352, "httpStatusCode": 200}', '32fc7423-9d09-4907-ad93-47afb5f28a09', '56823340-0cb5-4679-aab3-8fa552178a90', '{}'),
	('2a0c2aac-16c6-4141-8b8c-8981de93e2e9', 'observation-media', '56823340-0cb5-4679-aab3-8fa552178a90/5b9bb001-6d44-4b01-9a38-ac8d480d0033/4a398b5c-ccb0-4175-97e4-a23338437f06.jpg', '56823340-0cb5-4679-aab3-8fa552178a90', '2026-04-11 16:50:29.535574+00', '2026-04-11 16:50:29.535574+00', '2026-04-11 16:50:29.535574+00', '{"eTag": "\"9f22c8cf252e7d2e9ad10dcc29652488\"", "size": 53323, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:50:30.000Z", "contentLength": 53323, "httpStatusCode": 200}', 'b740b25f-a72c-4f1e-89fc-f149bbd667f2', '56823340-0cb5-4679-aab3-8fa552178a90', '{}'),
	('530b9a5a-2b16-4417-9736-e73097d17250', 'incident-media', '888758d2-5bf0-4ecb-a85e-cc998ebe775b/97d45f21-9f57-4b9c-969d-19f52e879d78/d7769b11-bc93-4016-ac5f-52ce83620d24.jpeg', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '2026-04-11 16:55:56.351476+00', '2026-04-11 16:55:56.351476+00', '2026-04-11 16:55:56.351476+00', '{"eTag": "\"a96061f2e36936f8a2d6e96dab9fde11\"", "size": 16018, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:55:57.000Z", "contentLength": 16018, "httpStatusCode": 200}', '44fdac18-30bc-4200-a7f8-9b8a343e74f5', '888758d2-5bf0-4ecb-a85e-cc998ebe775b', '{}'),
	('52d5b1fb-a616-4ec4-b041-7bf667811b06', 'observation-media', '71c422c5-ff93-495c-9f90-b8cf3e40d696/4b4c2ffc-e74b-4ce7-bc45-4a601ab8bc41/fda6d056-6868-4fd4-80e6-cbf4e1537b18.jpg', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '2026-04-11 16:58:44.357859+00', '2026-04-11 16:58:44.357859+00', '2026-04-11 16:58:44.357859+00', '{"eTag": "\"7ddec156f3ec6a269aad6ebfb58c8897\"", "size": 197500, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:58:45.000Z", "contentLength": 197500, "httpStatusCode": 200}', 'edd739a0-4b02-472b-b509-e49a8a04f2b0', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '{}'),
	('ea15656a-c5b0-46b6-9bf7-19086ab367c7', 'observation-media', '71c422c5-ff93-495c-9f90-b8cf3e40d696/2ca59963-860e-4290-a21e-e994bbc21070/e142f274-76ef-4a6b-a44a-b8c1161c91ff.jpg', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '2026-04-11 16:59:20.875891+00', '2026-04-11 16:59:20.875891+00', '2026-04-11 16:59:20.875891+00', '{"eTag": "\"5f47ee05073817ddc99adff3c84c563c\"", "size": 175510, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-11T16:59:21.000Z", "contentLength": 175510, "httpStatusCode": 200}', '2d4f64e1-dfa4-49ab-a7b8-9794bb4520b0', '71c422c5-ff93-495c-9f90-b8cf3e40d696', '{}'),
	('10dc0472-87f5-400f-a1d6-b720b28ca860', 'observation-media', '673de576-3a41-41fc-94b2-17223ed5acf6/be0c28d9-aec6-44a9-ba34-3d4c72210f8e/79d678b1-e67b-4a0d-90b4-6e61eea74e18.jpg', '673de576-3a41-41fc-94b2-17223ed5acf6', '2026-04-13 06:49:32.644288+00', '2026-04-13 06:49:32.644288+00', '2026-04-13 06:49:32.644288+00', '{"eTag": "\"7ddec156f3ec6a269aad6ebfb58c8897\"", "size": 197500, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-13T06:49:33.000Z", "contentLength": 197500, "httpStatusCode": 200}', '032406b9-07fa-4158-aacd-a8b175a3deab', '673de576-3a41-41fc-94b2-17223ed5acf6', '{}'),
	('94cd83f6-ef4f-4335-b3f6-3ac6250105d4', 'observation-media', 'cc60e20c-0986-4157-a153-1c62e0c76042/d3aa93d8-a3e9-478b-afe5-fab9ff918692/a5b2a619-ec7b-4d75-8b86-225c4b464dc7.jpg', 'cc60e20c-0986-4157-a153-1c62e0c76042', '2026-04-13 07:05:49.763061+00', '2026-04-13 07:05:49.763061+00', '2026-04-13 07:05:49.763061+00', '{"eTag": "\"7ddec156f3ec6a269aad6ebfb58c8897\"", "size": 197500, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-13T07:05:50.000Z", "contentLength": 197500, "httpStatusCode": 200}', '4d501a59-df73-4296-86b9-38ab4001866e', 'cc60e20c-0986-4157-a153-1c62e0c76042', '{}'),
	('0d32720a-74b3-4435-8ada-c10420baee1a', 'observation-media', 'cc60e20c-0986-4157-a153-1c62e0c76042/9fd7dbf6-57e9-40d4-9a98-3a9b96b60a16/b560d498-f737-421f-a820-8653523276c2.jpg', 'cc60e20c-0986-4157-a153-1c62e0c76042', '2026-04-13 07:17:36.528631+00', '2026-04-13 07:17:36.528631+00', '2026-04-13 07:17:36.528631+00', '{"eTag": "\"7ddec156f3ec6a269aad6ebfb58c8897\"", "size": 197500, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-13T07:17:37.000Z", "contentLength": 197500, "httpStatusCode": 200}', '09fb97ca-5d1d-4979-9a58-3dfef482962c', 'cc60e20c-0986-4157-a153-1c62e0c76042', '{}'),
	('95bea69e-5b4c-48b0-bf5b-ae9005c30aee', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/acb9189f-3362-47a8-960f-d8ccae990b6b/d5c9a906-d3d3-45ba-a9d5-efafe5bab2c8.jpeg', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-04-13 09:46:13.136682+00', '2026-04-13 09:46:13.136682+00', '2026-04-13 09:46:13.136682+00', '{"eTag": "\"dd5d7211a816eec913cd62415d17aa0a\"", "size": 2932345, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-13T09:46:14.000Z", "contentLength": 2932345, "httpStatusCode": 200}', '911a16b7-c01b-4d30-8d12-cdc865a355cc', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}'),
	('63744aa4-3b48-4d3b-94df-c1b933baac1a', 'observation-media', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce/1362a901-ab45-489d-8eb8-c76b9d2fc216/22903832-80af-40dd-a132-d0267924e2ef.png', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '2026-05-11 19:13:06.582139+00', '2026-05-11 19:13:06.582139+00', '2026-05-11 19:13:06.582139+00', '{"eTag": "\"06afc90aef3c6e615279421f9d4ffca2\"", "size": 260754, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-05-11T19:13:07.000Z", "contentLength": 260754, "httpStatusCode": 200}', 'c1760820-94ed-4211-bc0f-b5289de79243', '0f2cbdab-dfca-42c9-9a90-1b4b677a84ce', '{}');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 680, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict W57sVq0Pu2NcXbnIJ4JcoazWnIax21UVUc0VAIfSNFhpQyLP0aqOYo7dvVyCxeP

RESET ALL;
