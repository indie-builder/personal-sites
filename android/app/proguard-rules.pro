# kotlinx.serialization（Release R8；Debug 不参与但保持规则完整）
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keep,includedescriptorclasses class cn.lovemyrmb.personalsite.**$$serializer { *; }
-keepclassmembers class cn.lovemyrmb.personalsite.** {
    *** Companion;
}
-keepclasseswithmembers class cn.lovemyrmb.personalsite.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit 接口泛型签名
-keepattributes Signature
-keepattributes Exceptions
