--
-- PostgreSQL database dump
--

-- Dumped from database version 14.1
-- Dumped by pg_dump version 14.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    email character varying(64) NOT NULL,
    password character varying(246),
    created bigint,
    last_ping bigint,
    banned boolean DEFAULT false,
    "2fa_token" character varying(200),
    admin boolean DEFAULT false,
    session_seed character varying(256),
    email_verify_token character varying,
    g_oauth_sub character varying,
    two_factor_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: athena_action_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.athena_action_logs (
    id integer NOT NULL,
    account_id integer,
    device_id integer,
    action character varying(38),
    user_ip character varying(1),
    device_ip character varying(19),
    meta json,
    created_at bigint,
    dongle_id character varying(8)
);


--
-- Name: athena_action_logs_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.athena_action_logs_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: athena_action_logs_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.athena_action_logs_account_id_seq OWNED BY public.athena_action_logs.account_id;


--
-- Name: athena_action_logs_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.athena_action_logs_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: athena_action_logs_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.athena_action_logs_device_id_seq OWNED BY public.athena_action_logs.device_id;


--
-- Name: athena_action_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.athena_action_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: athena_action_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.athena_action_logs_id_seq OWNED BY public.athena_action_logs.id;


--
-- Name: athena_returned_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.athena_returned_data (
    id integer NOT NULL,
    device_id integer NOT NULL,
    type character varying(12),
    data json,
    created_at bigint,
    uuid character varying(12),
    resolved_at bigint
);


--
-- Name: athena_returned_data_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.athena_returned_data_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: athena_returned_data_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.athena_returned_data_device_id_seq OWNED BY public.athena_returned_data.device_id;


--
-- Name: athena_returned_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.athena_returned_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: athena_returned_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.athena_returned_data_id_seq OWNED BY public.athena_returned_data.id;


--
-- Name: device_authorised_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_authorised_users (
    id integer NOT NULL,
    account_id integer NOT NULL,
    device_id integer NOT NULL,
    athena boolean DEFAULT false NOT NULL,
    unpair boolean DEFAULT false NOT NULL,
    view_drives boolean DEFAULT false NOT NULL,
    created_at bigint NOT NULL
);


--
-- Name: device_authorised_users_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_authorised_users_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_authorised_users_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_authorised_users_account_id_seq OWNED BY public.device_authorised_users.account_id;


--
-- Name: device_authorised_users_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_authorised_users_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_authorised_users_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_authorised_users_device_id_seq OWNED BY public.device_authorised_users.device_id;


--
-- Name: device_authorised_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_authorised_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_authorised_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_authorised_users_id_seq OWNED BY public.device_authorised_users.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    dongle_id text NOT NULL,
    account_id integer,
    imei text,
    serial text,
    device_type text,
    public_key text,
    created bigint,
    last_ping bigint,
    storage_used bigint,
    max_storage bigint,
    ignore_uploads boolean,
    nickname character varying(20)
);


--
-- Name: devices_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devices_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devices_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devices_account_id_seq OWNED BY public.devices.account_id;


--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: drive_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drive_segments (
    id integer NOT NULL,
    segment_id bigint NOT NULL,
    drive_identifier character varying(20) NOT NULL,
    dongle_id character varying(12) NOT NULL,
    duration bigint,
    distance_meters bigint,
    upload_complete boolean DEFAULT false NOT NULL,
    is_processed boolean DEFAULT false NOT NULL,
    is_stalled boolean DEFAULT false NOT NULL,
    created bigint DEFAULT 0 NOT NULL,
    process_attempts smallint DEFAULT 0 NOT NULL
);


--
-- Name: drive_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drive_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drive_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drive_segments_id_seq OWNED BY public.drive_segments.id;


--
-- Name: drives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drives (
    id integer NOT NULL,
    identifier character varying(20),
    dongle_id character varying(8),
    max_segment bigint,
    duration double precision,
    distance_meters double precision,
    filesize bigint,
    upload_complete boolean DEFAULT false NOT NULL,
    is_processed boolean DEFAULT false NOT NULL,
    created bigint,
    last_upload bigint,
    is_preserved boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    drive_date bigint DEFAULT 0,
    is_physically_removed boolean DEFAULT false NOT NULL,
    metadata text
);


--
-- Name: drives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drives_id_seq OWNED BY public.drives.id;


--
-- Name: oauth_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_accounts (
    id integer NOT NULL,
    account_id integer NOT NULL,
    email character varying NOT NULL,
    created time without time zone,
    last_used character varying,
    refresh character varying,
    provider character varying,
    external_id character varying,
    enabled boolean DEFAULT false NOT NULL
);


--
-- Name: oauth_accounts_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.oauth_accounts_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: oauth_accounts_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.oauth_accounts_account_id_seq OWNED BY public.oauth_accounts.account_id;


--
-- Name: oauth_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.oauth_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: oauth_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.oauth_accounts_id_seq OWNED BY public.oauth_accounts.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    sessionkey character varying,
    account_id bigint,
    ip_address character varying,
    expires bigint
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: athena_action_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_action_logs ALTER COLUMN id SET DEFAULT nextval('public.athena_action_logs_id_seq'::regclass);


--
-- Name: athena_action_logs account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_action_logs ALTER COLUMN account_id SET DEFAULT nextval('public.athena_action_logs_account_id_seq'::regclass);


--
-- Name: athena_action_logs device_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_action_logs ALTER COLUMN device_id SET DEFAULT nextval('public.athena_action_logs_device_id_seq'::regclass);


--
-- Name: athena_returned_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_returned_data ALTER COLUMN id SET DEFAULT nextval('public.athena_returned_data_id_seq'::regclass);


--
-- Name: athena_returned_data device_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_returned_data ALTER COLUMN device_id SET DEFAULT nextval('public.athena_returned_data_device_id_seq'::regclass);


--
-- Name: device_authorised_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_authorised_users ALTER COLUMN id SET DEFAULT nextval('public.device_authorised_users_id_seq'::regclass);


--
-- Name: device_authorised_users account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_authorised_users ALTER COLUMN account_id SET DEFAULT nextval('public.device_authorised_users_account_id_seq'::regclass);


--
-- Name: device_authorised_users device_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_authorised_users ALTER COLUMN device_id SET DEFAULT nextval('public.device_authorised_users_device_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: drive_segments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drive_segments ALTER COLUMN id SET DEFAULT nextval('public.drive_segments_id_seq'::regclass);


--
-- Name: drives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drives ALTER COLUMN id SET DEFAULT nextval('public.drives_id_seq'::regclass);


--
-- Name: oauth_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts ALTER COLUMN id SET DEFAULT nextval('public.oauth_accounts_id_seq'::regclass);


--
-- Name: oauth_accounts account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts ALTER COLUMN account_id SET DEFAULT nextval('public.oauth_accounts_account_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_un UNIQUE (email);


--
-- Name: athena_action_logs athena_action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_action_logs
    ADD CONSTRAINT athena_action_logs_pkey PRIMARY KEY (id);


--
-- Name: athena_action_logs athena_action_logs_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_action_logs
    ADD CONSTRAINT athena_action_logs_un UNIQUE (id);


--
-- Name: athena_returned_data athena_returned_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_returned_data
    ADD CONSTRAINT athena_returned_data_pkey PRIMARY KEY (id);


--
-- Name: device_authorised_users device_authorised_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_authorised_users
    ADD CONSTRAINT device_authorised_users_pkey PRIMARY KEY (id);


--
-- Name: device_authorised_users device_authorised_users_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_authorised_users
    ADD CONSTRAINT device_authorised_users_un UNIQUE (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: devices devices_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_un UNIQUE (id);


--
-- Name: devices devices_unique_dongle; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_unique_dongle UNIQUE (dongle_id);


--
-- Name: drive_segments drive_segment_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drive_segments
    ADD CONSTRAINT drive_segment_uk UNIQUE (id);


--
-- Name: drive_segments drive_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drive_segments
    ADD CONSTRAINT drive_segments_pkey PRIMARY KEY (id);


--
-- Name: drives drives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drives
    ADD CONSTRAINT drives_pkey PRIMARY KEY (id);


--
-- Name: drives drives_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drives
    ADD CONSTRAINT drives_un UNIQUE (id);


--
-- Name: oauth_accounts oauth_accounts_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_accounts
    ADD CONSTRAINT oauth_accounts_pk PRIMARY KEY (id);


--
-- Name: accounts primary_uni; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT primary_uni UNIQUE (id);


--
-- Name: sessions sessions_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pk PRIMARY KEY (id);


--
-- Name: athena_returned_data un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_returned_data
    ADD CONSTRAINT un UNIQUE (id);


--
-- Name: device_authorised_users device_authorised_users_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_authorised_users
    ADD CONSTRAINT device_authorised_users_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: device_authorised_users device_authorised_users_fk_1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_authorised_users
    ADD CONSTRAINT device_authorised_users_fk_1 FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: athena_returned_data device_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athena_returned_data
    ADD CONSTRAINT device_id_fk FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: devices devices_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: drive_segments drive_segments_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drive_segments
    ADD CONSTRAINT drive_segments_fk FOREIGN KEY (dongle_id) REFERENCES public.devices(dongle_id);


--
-- Name: drives drives_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drives
    ADD CONSTRAINT drives_fk FOREIGN KEY (dongle_id) REFERENCES public.devices(dongle_id);


--
-- PostgreSQL database dump complete
--

