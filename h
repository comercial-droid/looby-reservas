[1mdiff --git a/app/login/page.tsx b/app/login/page.tsx[m
[1mindex 53e8fe3..8d87222 100644[m
[1m--- a/app/login/page.tsx[m
[1m+++ b/app/login/page.tsx[m
[36m@@ -11,7 +11,6 @@[m [mfunction LoginContent() {[m
 [m
   const [email, setEmail] = useState('')[m
   const [password, setPassword] = useState('')[m
[31m-[m
   const [loading, setLoading] = useState(false)[m
   const [errorMsg, setErrorMsg] = useState<string | null>(null)[m
 [m
